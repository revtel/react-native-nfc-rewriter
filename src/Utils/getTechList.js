import {getObservedTechnologies} from '../features/tag-discovery/model';

const getTechList = (tag) => {
  return getObservedTechnologies(tag);
};

export {getTechList};
