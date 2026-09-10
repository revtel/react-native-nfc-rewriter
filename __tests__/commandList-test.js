import {
  appendCommand,
  moveCommand,
  removeCommand,
  replaceCommand,
  updateParameter,
} from '../src/features/transceive/commandList';

describe('command list', () => {
  it('edits commands immutably', () => {
    const commands = [[1], [2]];

    expect(appendCommand(commands, [3])).toEqual([[1], [2], [3]]);
    expect(removeCommand(commands, 0)).toEqual([[2]]);
    expect(replaceCommand(commands, 1, [9])).toEqual([[1], [9]]);
    expect(moveCommand(commands, 0, 1)).toEqual([[2], [1]]);
    expect(moveCommand(commands, 0, 3)).toBe(commands);
    expect(commands).toEqual([[1], [2]]);
  });

  it('updates one parameter without mutating the input', () => {
    const parameters = [{name: 'one', payload: []}, {name: 'two'}];
    expect(updateParameter(parameters, 0, [1, 2])).toEqual([
      {name: 'one', payload: [1, 2]},
      {name: 'two'},
    ]);
    expect(parameters[0].payload).toEqual([]);
  });
});
