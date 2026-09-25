const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLACEHOLDER = /^\$\{(.+):(u8|u16be|u16le|bytes)\}$/;

function tokenize(expression) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('Expression is required');
  }
  const tokens = expression.match(
    /\s*(?:0[xX][0-9a-fA-F]+|\d+|[A-Za-z_][A-Za-z0-9_]*|[-()+*])/g,
  );
  if (
    !tokens ||
    tokens.join('').replace(/\s/g, '') !== expression.replace(/\s/g, '')
  ) {
    throw new Error(`Invalid expression: ${expression}`);
  }
  return tokens.map((token) => token.trim());
}

function parseExpression(expression, variables = {}) {
  const tokens = tokenize(expression);
  let position = 0;
  const referenced = new Set();

  function primary() {
    const token = tokens[position++];
    if (token === '-') {
      return -primary();
    }
    if (token === '(') {
      const value = addition();
      if (tokens[position++] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      return value;
    }
    if (!token) {
      throw new Error('Missing value');
    }
    if (/^0[xX][0-9a-fA-F]+$/.test(token)) {
      return Number.parseInt(token, 16);
    }
    if (/^\d+$/.test(token)) {
      return Number.parseInt(token, 10);
    }
    if (IDENTIFIER.test(token)) {
      referenced.add(token);
      if (!Object.prototype.hasOwnProperty.call(variables, token)) {
        throw new Error(`Undefined variable: ${token}`);
      }
      if (!Number.isSafeInteger(variables[token])) {
        throw new Error(`Variable is not an integer: ${token}`);
      }
      return variables[token];
    }
    throw new Error(`Unexpected token: ${token}`);
  }

  function multiplication() {
    let value = primary();
    while (tokens[position] === '*') {
      position++;
      value *= primary();
    }
    return value;
  }

  function addition() {
    let value = multiplication();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const op = tokens[position++];
      const rhs = multiplication();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  const value = addition();
  if (position !== tokens.length) {
    throw new Error(`Unexpected token: ${tokens[position]}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error('Expression must produce a safe integer');
  }
  return {value, referenced: [...referenced]};
}

function expressionNames(expression) {
  const names = new Set();
  const tokens = tokenize(expression);
  tokens.forEach((token) => {
    if (IDENTIFIER.test(token)) {
      names.add(token);
    }
  });
  const placeholders = Object.fromEntries([...names].map((name) => [name, 0]));
  parseExpression(expression, placeholders);
  return [...names];
}

function encodeInteger(value, format) {
  const width =
    format === 'u8' ? 1 : format === 'u16be' || format === 'u16le' ? 2 : 0;
  if (
    !width ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= 2 ** (width * 8)
  ) {
    throw new Error(`Value ${value} does not fit ${format}`);
  }
  if (width === 1) {
    return [value];
  }
  return format === 'u16be'
    ? [Math.floor(value / 256), value % 256]
    : [value % 256, Math.floor(value / 256)];
}

function parseTemplate(template) {
  if (typeof template !== 'string' || !template.trim()) {
    throw new Error('Command bytes are required');
  }
  const parts = template.trim().match(/\$\{[^}]+\}|[^\s]+/g) || [];
  return parts.map((part) => {
    if (/^[0-9a-fA-F]{2}$/.test(part)) {
      return {literal: Number.parseInt(part, 16)};
    }
    const match = part.match(PLACEHOLDER);
    if (!match) {
      throw new Error(`Invalid command byte: ${part}`);
    }
    const [, expression, format] = match;
    if (format === 'bytes') {
      if (!IDENTIFIER.test(expression)) {
        throw new Error('Byte-array placeholder needs one variable');
      }
    } else {
      expressionNames(expression);
    }
    return {expression, format};
  });
}

function templateNames(template) {
  return [
    ...new Set(
      parseTemplate(template).flatMap((part) =>
        part.format === 'bytes'
          ? [part.expression]
          : part.expression
          ? expressionNames(part.expression)
          : [],
      ),
    ),
  ];
}

function resolveTemplate(template, variables) {
  const bytes = parseTemplate(template).flatMap((part) => {
    if ('literal' in part) {
      return [part.literal];
    }
    if (part.format === 'bytes') {
      const value = variables[part.expression];
      if (
        !Array.isArray(value) ||
        !value.every(
          (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
        )
      ) {
        throw new Error(`Variable is not a byte array: ${part.expression}`);
      }
      return value;
    }
    return encodeInteger(
      parseExpression(part.expression, variables).value,
      part.format,
    );
  });
  if (bytes.length === 0) {
    throw new Error('Command cannot be empty');
  }
  return bytes;
}

export {
  IDENTIFIER,
  encodeInteger,
  expressionNames,
  parseExpression,
  parseTemplate,
  resolveTemplate,
  templateNames,
};
