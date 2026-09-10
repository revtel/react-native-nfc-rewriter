import React from 'react';
import {createRecordRepository} from './services/records/recordRepository';

const defaultActions = {
  appendRecord: async () => [],
  initStorage: async () => [],
  removeRecord: async () => [],
  setShowNfcPrompt: () => {},
  setStorage: async () => [],
  updateRecord: async () => [],
};

const Context = React.createContext({
  state: {showNfcPrompt: false, storageCache: []},
  actions: defaultActions,
});

class Provider extends React.Component {
  constructor(props) {
    super(props);
    this.recordRepository = createRecordRepository();
    this.state = {
      showNfcPrompt: false,
      storageCache: [],
    };
    this.actions = {
      appendRecord: this.appendRecord,
      initStorage: this.initStorage,
      removeRecord: this.removeRecord,
      setShowNfcPrompt: this.setShowNfcPrompt,
      setStorage: this.setStorage,
      updateRecord: this.updateRecord,
    };
  }

  setShowNfcPrompt = (showNfcPrompt) => {
    this.setState({showNfcPrompt});
  };

  syncRecords = (storageCache) => {
    this.setState({storageCache});
    return storageCache;
  };

  initStorage = async () =>
    this.syncRecords(await this.recordRepository.load());

  setStorage = async (records) =>
    this.syncRecords(await this.recordRepository.save(records));

  appendRecord = async (record) =>
    this.syncRecords(await this.recordRepository.append(record));

  updateRecord = async (idx, record) =>
    this.syncRecords(await this.recordRepository.update(idx, record));

  removeRecord = async (idx) =>
    this.syncRecords(await this.recordRepository.remove(idx));

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
