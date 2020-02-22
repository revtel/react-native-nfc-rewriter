import React from 'react';
import {
  Modal,
  Animated,
  Dimensions,
} from 'react-native';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class PopupModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };

    this.animatedValue = new Animated.Value(0);

    this.open = () => {
      const {duration=200, startupDelay=100} = props.animControl || {};

      this.setState({open: true}, async () => {
        if (startupDelay) {
          await delay(startupDelay);
        }

        Animated.timing(this.animatedValue, {
          toValue: 1,
          duration,
          useNativeDriver: true, 
        }).start();
      });
    };

    this.close = () => {
      const {duration=200, startupDelay=100} = props.animControl || {};

      Animated.timing(this.animatedValue, {
        toValue: 0,
        duration,
        useNativeDriver: true, 
      }).start(async () => {
        if (startupDelay) {
          await delay(startupDelay);
        }

        this.setState({open: false});
      });
    };

    this._updateStyleFromProps(props);
  }

  render() {
    let {open} = this.state;

    if (open) {
      return (
        <Modal transparent>
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

    return null;
  }

  _updateStyleFromProps = props => {
    const {backdropColor='rgba(0, 0, 0, 0.6)'} = props.backdropControl || {};

    this.backdropStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: Dimensions.get('window').width,
      height: Dimensions.get('window').height, 
      opacity: this.animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }), 
      backgroundColor: backdropColor
    };

    const {left=30, height=300, borderRadius=20, padding=20, backgroundColor='white'} = props.popupStyle || props.promptStyle || {};

    this.popupStyle = {
      position: 'absolute',
      left,
      bottom: -(2 * height), 
      transform: [
        {
          translateY: this.animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(2 * height)],
          })
        }
      ],
      width: Dimensions.get('window').width - (2 * left),
      height,
      padding,
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      backgroundColor,
    };
  }
}

export default PopupModal;
