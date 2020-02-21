import React from 'react';
import {
  Modal,
  Animated,
  Dimensions,
} from 'react-native';

class PopupModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };

    const duration = 200;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    this.animatedValue = new Animated.Value(0);

    this.open = () => {
      this.setState({open: true}, async () => {
        await delay(100);

        Animated.timing(this.animatedValue, {
          toValue: 1,
          duration,
          useNativeDriver: true, 
        }).start();
      });
    };

    this.close = () => {
      Animated.timing(this.animatedValue, {
        toValue: 0,
        duration,
        useNativeDriver: true, 
      }).start(async () => {
        await delay(100);
        this.setState({open: false});
      });
    };

    this.backdropStyle = {
      flex: 1, 
      opacity: this.animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      }), 
      backgroundColor: props.backdropColor || 'rgba(0, 0, 0, 0.6)'
    };

    let {left=30, height=300, padding=20, borderRadius=20, backgroundColor='white'} = props.promptStyle || {};
    this.promptStyle = {
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
      borderRadius,
      backgroundColor,
    };
  }

  render() {
    let {open} = this.state;

    if (open) {
      return (
        <Modal transparent>
          <Animated.View style={this.backdropStyle}>
            <Animated.View style={this.promptStyle}>
              {this.props.children}
            </Animated.View>
          </Animated.View>
        </Modal>
      );
    }

    return null;
  }
}

export default PopupModal;