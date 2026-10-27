class JsonValueError extends Error {
  constructor(code) {
    super(code);
    this.name = 'JsonValueError';
    this.code = code;
  }
}

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

// A JSON snapshot must not invoke accessors/toJSON or silently discard values.
// No product resource budget is imposed here: repository reads may contain a
// legacy library larger than the new archive support budget.
function cloneJsonValue(value, {maxDepth = Infinity, maxNodes = Infinity} = {}) {
  let result;
  let nodes = 0;
  const active = new WeakSet();
  const stack = [{value, depth: 1, parent: null, key: null}];
  while (stack.length) {
    const frame = stack.pop();
    if (frame.leave) {
      active.delete(frame.leave);
      continue;
    }
    nodes += 1;
    if (nodes > maxNodes) throw new JsonValueError('json-node-limit');
    if (frame.depth > maxDepth) throw new JsonValueError('json-depth-limit');
    const source = frame.value;
    let copy;
    if (source === null || typeof source === 'string' || typeof source === 'boolean') {
      copy = source;
    } else if (typeof source === 'number') {
      if (!Number.isFinite(source) || Object.is(source, -0)) {
        throw new JsonValueError('invalid-json-number');
      }
      copy = source;
    } else if (typeof source === 'object') {
      if (active.has(source)) throw new JsonValueError('invalid-json-value');
      const array = Array.isArray(source);
      const prototype = Object.getPrototypeOf(source);
      if (!array && prototype !== Object.prototype && prototype !== null) {
        throw new JsonValueError('invalid-json-value');
      }
      if (array && nodes + source.length > maxNodes) throw new JsonValueError('json-node-limit');
      const keys = Reflect.ownKeys(source);
      if (array) {
        if (keys.length !== source.length + 1 || !own(source, 'length')) {
          throw new JsonValueError('invalid-json-value');
        }
        for (let index = 0; index < source.length; index++) {
          if (!own(source, String(index))) throw new JsonValueError('invalid-json-value');
        }
      }
      if (nodes + keys.length - (array ? 1 : 0) > maxNodes) throw new JsonValueError('json-node-limit');
      copy = array ? new Array(source.length) : {};
      active.add(source);
      stack.push({leave: source});
      const properties = array ? keys.filter((key) => key !== 'length') : keys;
      for (let index = properties.length - 1; index >= 0; index--) {
        const key = properties[index];
        const descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (typeof key !== 'string' || !descriptor.enumerable || !own(descriptor, 'value')) {
          throw new JsonValueError('invalid-json-value');
        }
        stack.push({value: descriptor.value, depth: frame.depth + 1, parent: copy, key});
      }
    } else {
      throw new JsonValueError('invalid-json-value');
    }
    if (frame.parent === null) {
      result = copy;
    } else {
      // defineProperty preserves an own '__proto__' key without changing a prototype.
      Object.defineProperty(frame.parent, frame.key, {
        value: copy, enumerable: true, writable: true, configurable: true,
      });
    }
  }
  return result;
}

function canonicalJson(value) {
  const snapshot = cloneJsonValue(value);
  const output = [];
  const stack = [{value: snapshot}];
  while (stack.length) {
    const frame = stack.pop();
    if (own(frame, 'text')) {
      output.push(frame.text);
      continue;
    }
    const current = frame.value;
    if (current === null || typeof current !== 'object') {
      output.push(JSON.stringify(current));
    } else if (Array.isArray(current)) {
      output.push('[');
      stack.push({text: ']'});
      for (let index = current.length - 1; index >= 0; index--) {
        stack.push({value: current[index]});
        if (index > 0) stack.push({text: ','});
      }
    } else {
      output.push('{');
      stack.push({text: '}'});
      const keys = Object.keys(current).sort();
      for (let index = keys.length - 1; index >= 0; index--) {
        const key = keys[index];
        stack.push({value: current[key]});
        stack.push({text: ':'});
        stack.push({text: JSON.stringify(key)});
        if (index > 0) stack.push({text: ','});
      }
    }
  }
  return output.join('');
}

function jsonValuesEqual(first, second) {
  return canonicalJson(first) === canonicalJson(second);
}

// Counts actual UTF-8 bytes without allocating an encoded copy. Unpaired raw
// surrogates cannot come from a strict native UTF-8 decoder; reject them here too.
function utf8ByteLength(text, maxBytes = Infinity) {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new JsonValueError('invalid-utf8');
      bytes += 4;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new JsonValueError('invalid-utf8');
    } else bytes += 3;
    if (bytes > maxBytes) return bytes;
  }
  return bytes;
}

export {JsonValueError, cloneJsonValue, canonicalJson, jsonValuesEqual, utf8ByteLength};
