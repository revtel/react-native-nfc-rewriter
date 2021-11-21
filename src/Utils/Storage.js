import AsyncStorage from '@react-native-async-storage/async-storage';

function createStorage(key) {
  let cache = null;

  async function invalidateCache() {
    let nextList = [];
    try {
      nextList = JSON.parse(await AsyncStorage.getItem(key)) || [];
    } catch (ex) {
      console.warn('fail to parse');
    }
    console.warn(nextList);
    console.log(JSON.stringify(nextList));
    cache = nextList;
  }

  async function get(force = false) {
    if (cache === null || force) {
      await invalidateCache();
    }

    return cache;
  }

  async function set(data) {
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    await AsyncStorage.setItem(key, data);
    await invalidateCache();
  }

  return {
    get,
    set,
  };
}

export {createStorage};
