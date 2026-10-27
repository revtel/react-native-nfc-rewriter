import React from 'react';
import {createRecordRepository} from './services/records/recordRepository';

const defaultActions = {
  appendRecord: async () => [],
  initStorage: async () => [],
  removeRecord: async () => [],
  setShowNfcPrompt: () => {},
  setStorage: async () => [],
  updateRecord: async () => [],
  updateRecordSnapshot: async () => ({records: [], revision: 0}),
  getRecordSnapshot: async () => ({records: [], revision: 0}),
  previewRecordImport: async () => null,
  commitRecordImport: async () => null,
  discardRecordImport: () => {},
};

const Context = React.createContext({
  state: {
    showNfcPrompt: false,
    storageCache: [],
    storageStatus: 'loading',
    storageError: null,
    storageRevision: 0,
  },
  actions: defaultActions,
});

class Provider extends React.Component {
  constructor(props) {
    super(props);
    this.recordRepository = props.recordRepository || createRecordRepository();
    this.state = {
      showNfcPrompt: false,
      storageCache: [],
      storageStatus: 'loading',
      storageError: null,
      storageRevision: 0,
    };
    this.actions = {
      appendRecord: this.appendRecord,
      initStorage: this.initStorage,
      removeRecord: this.removeRecord,
      setShowNfcPrompt: this.setShowNfcPrompt,
      setStorage: this.setStorage,
      updateRecord: this.updateRecord,
      updateRecordSnapshot: this.updateRecordSnapshot,
      getRecordSnapshot: this.getRecordSnapshot,
      previewRecordImport: this.previewRecordImport,
      commitRecordImport: this.commitRecordImport,
      discardRecordImport: this.discardRecordImport,
    };
  }

  componentDidMount() {
    this.recordsMounted = true;
    this.unsubscribeRecords = this.recordRepository.subscribe(this.syncRepository);
    this.syncRepository();
  }

  componentWillUnmount() {
    this.recordsMounted = false;
    this.unsubscribeRecords?.();
  }

  setShowNfcPrompt = (showNfcPrompt) => {
    this.setState({showNfcPrompt});
  };

  syncRepository = () => {
    if (!this.recordsMounted) return;
    const {status, error, revision} = this.recordRepository.getState();
    this.setState({
      storageCache: this.recordRepository.getAll(),
      storageStatus: status,
      storageError: error,
      storageRevision: revision,
    });
  };

  runRecordAction = async (operation) => {
    try {
      return await operation();
    } finally {
      this.syncRepository();
    }
  };

  initStorage = () => this.runRecordAction(() => this.recordRepository.load());
  setStorage = (records, options) =>
    this.runRecordAction(() => this.recordRepository.save(records, options));
  appendRecord = (record) =>
    this.runRecordAction(() => this.recordRepository.append(record));
  updateRecord = (idx, record, options) =>
    this.runRecordAction(() => this.recordRepository.update(idx, record, options));
  updateRecordSnapshot = (idx, record, options) =>
    this.runRecordAction(() => this.recordRepository.updateWithSnapshot(idx, record, options));
  removeRecord = (idx, options) =>
    this.runRecordAction(() => this.recordRepository.remove(idx, options));
  getRecordSnapshot = () => this.recordRepository.getSnapshot();
  previewRecordImport = (incoming) => this.recordRepository.previewImport(incoming);
  commitRecordImport = (receipt) =>
    this.runRecordAction(() => this.recordRepository.commitImport(receipt));
  discardRecordImport = (receipt) => this.recordRepository.discardImport(receipt);

  render() {
    return (
      <Context.Provider
        value={{
          state: this.state,
          actions: this.actions,
        }}>
        {this.props.children}
      </Context.Provider>
    );
  }
}

export {Context, Provider};
