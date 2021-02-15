import React from 'react';

const Context = React.createContext();

const Actions = {};

class Provider extends React.Component {
  constructor(props) {
    super();
    this.state = {
      showNfcPrompt: false,
    };
  }

  componentDidMount() {
    Actions.setShowNfcPrompt = (show) => {
      this.setState({showNfcPrompt: show});
    };
  }

  render() {
    return (
      <Context.Provider
        value={{
          state: this.state,
          actions: Actions,
        }}>
        {this.props.children}
      </Context.Provider>
    );
  }
}

export {Context, Provider, Actions};
