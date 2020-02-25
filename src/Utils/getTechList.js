import {Platform} from 'react-native';

const getTechList = tag => {
  let techs = [];
  if (Platform.OS === 'ios') {
    techs.push(tag.tech);
  } else {
    techs = tag.techTypes;
  }
  return techs.map(tech => tech.replace(/android\.nfc\.tech\./, ''));
}

export {
  getTechList
}