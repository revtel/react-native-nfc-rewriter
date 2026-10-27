import React from 'react';
import {FlatList, Modal, Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import ImportPreview from '../src/features/record-library/ImportPreview';
import {summarizeLibrary} from '../src/features/record-library/recordInfo';

function text(tree) {
  return tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .join(' ');
}
function action(tree, label) {
  return tree.root.findAll(
    (node) =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
}
function preview(incoming) {
  return {
    incoming,
    name: 'backup.json',
    metadata: {exportedAt: '2026-10-27T00:00:00.000Z'},
    summary: summarizeLibrary(incoming),
    plan: {
      receipt: 'r1',
      currentCount: 5,
      incomingCount: incoming.length,
      addedCount: 2,
      existingCount: incoming.length - 2,
      finalCount: 7,
    },
  };
}

test('preview names are source entries rendered as inert virtualized text, with candidate counts separate', async () => {
  const incoming = [
    null,
    {name: 'A long future record', payload: {kind: 'future'}},
  ];
  const onConfirm = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <ImportPreview
        preview={preview(incoming)}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
  });
  expect(text(tree)).toContain('Current records: 5');
  expect(text(tree)).toContain('After import: 7');
  expect(text(tree)).toContain('Unsupported records: 2');
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(0);
  await act(async () => action(tree, 'Show record names').props.onPress());
  expect(tree.root.findByType(FlatList).props.data).toHaveLength(2);
  expect(text(tree)).toContain('A long future record');
  expect(text(tree)).toContain('Record 1');
  expect(onConfirm).not.toHaveBeenCalled();
  await act(async () => action(tree, 'Add 2 records').props.onPress());
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});

test('no-new previews disable commit and busy previews disable cancellation', async () => {
  const value = preview([]);
  value.plan.addedCount = 0;
  let tree;
  await act(async () => {
    tree = renderer.create(
      <ImportPreview
        preview={value}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
  });
  expect(text(tree)).toContain('This backup has no records.');
  expect(action(tree, 'Add 0 records').props.disabled).toBe(true);
  await act(async () => {
    tree.update(
      <ImportPreview
        preview={value}
        committing
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
  });
  expect(action(tree, 'CANCEL').props.disabled).toBe(true);
  expect(action(tree, 'Adding records…').props.disabled).toBe(true);
  expect(tree.root.findByType(Modal).props.onRequestClose).toEqual(
    expect.any(Function),
  );
  await act(async () => tree.unmount());
});
