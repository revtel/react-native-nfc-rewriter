function appendCommand(commands, command) {
  return [...commands, command];
}

function removeCommand(commands, idx) {
  return commands.filter((_, currentIdx) => currentIdx !== idx);
}

function replaceCommand(commands, idx, command) {
  return commands.map((current, currentIdx) =>
    currentIdx === idx ? command : current,
  );
}

function moveCommand(commands, fromIdx, toIdx) {
  if (
    fromIdx === toIdx ||
    fromIdx < 0 ||
    toIdx < 0 ||
    fromIdx >= commands.length ||
    toIdx >= commands.length
  ) {
    return commands;
  }

  const nextCommands = [...commands];
  const [command] = nextCommands.splice(fromIdx, 1);
  nextCommands.splice(toIdx, 0, command);
  return nextCommands;
}

function updateParameter(parameters, idx, payload) {
  return parameters.map((parameter, currentIdx) =>
    currentIdx === idx ? {...parameter, payload} : parameter,
  );
}

export {
  appendCommand,
  moveCommand,
  removeCommand,
  replaceCommand,
  updateParameter,
};
