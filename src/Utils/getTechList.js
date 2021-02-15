import {Platform} from 'react-native';

const getTechList = (tag) => {
  let techs = [];
  if (Platform.OS === 'ios') {
    if (!tag.tech) {
      // it might happen when we use legacy `registerTagEvent`
      return ['Ndef'];
    }
    techs.push(tag.tech);
  } else {
    techs = tag.techTypes;
  }
  return techs.map((tech) => tech.replace(/android\.nfc\.tech\./, ''));
};

export {getTechList};
