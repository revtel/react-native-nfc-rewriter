import React from 'react';
import {
  Modal,
  Animated,
  Dimensions,
} from 'react-native';

class PopupModal extends React.Component {
  static defaultProps = {
    popupStyle: {},
    backdropStyle: {},
    animControl: {
      backdropDuration: 200,
      popupDuration: 150,
    }
  }

  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };

    this.animatedValue = new Animated.Value(0);
    this.backdropAnimatedValue = new Animated.Value(0);

    this._updateBackdropStyle(props);
    this._updatePopupStyle(props);
  }

  render() {
    let {open} = this.state;

    return (
      <Modal 
        transparent
        visible={open}
      >
        <Animated.View style={this.backdropStyle}>
          <Animated.View style={this.popupStyle}>
              {typeof this.props.children === 'function' ? (
                this.props.children({
                  open: this.open,
                  close: this.close,
                })
              ) : this.props.children}
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }

  _updateBackdropStyle = props => {
    const mergedStyle = {...defaultStyle.backdrop, ...props.backdropStyle,};

    this.backdropStyle = {
      ...mergedStyle,
      position: 'absolute',
      top: 0,
      left: 0,
      width: Dimensions.get('window').width,
      height: Dimensions.get('window').height, 
      opacity: this.backdropAnimatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }), 
    };
  };

  _updatePopupStyle = props => {
    const mergedStyle = {...defaultStyle.popup, ...props.popupStyle,};
    const height = mergedStyle.height + 2 * mergedStyle.padding;

    this.popupStyle = {
      ...mergedStyle,
      position: 'absolute',
      left: mergedStyle.left,
      bottom: -height, 
      transform: [
        {
          translateY: this.animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -height],
          })
        }
      ],
      width: Dimensions.get('window').width - (2 * mergedStyle.left),
      height,
    };
  }

  open = () => {
    const {popupDuration, backdropDuration} = this.props.animControl;

    this.setState({open: true}, async () => {
      Animated.sequence([
        Animated.timing(this.backdropAnimatedValue, {
          toValue: 1,
          duration: backdropDuration,
        }),
        Animated.timing(this.animatedValue, {
          toValue: 1,
          duration: popupDuration,
        }),
      ]).start();
    });
  };

  close = () => {
    const {popupDuration, backdropDuration} = this.props.animControl;

    Animated.sequence([
      Animated.timing(this.animatedValue, {
        toValue: 0,
        duration: popupDuration,
      }),
      Animated.timing(this.backdropAnimatedValue, {
        toValue: 0,
        duration: backdropDuration,
      }),
    ]).start(async () => {
      this.setState({open: false});
    });
  };
}

const defaultStyle = {
  popup: {
    left: 30, 
    height: 300, 
    borderRadius: 20, 
    padding: 20, 
    backgroundColor: 'white'
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)' 
  }
};

export default PopupModal;
