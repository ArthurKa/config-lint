import { DockerfileParser } from 'dockerfile-ast';

type Position = { line: number; character: number };

export const parseDockerfile = (text: string) => {
  const document = DockerfileParser.parse(text);
  const starts = [0];
  for(let index = 0; index < text.length; index++) {
    if(text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  const offset = (position: Position): number => (starts[position.line] ?? text.length) + position.character;
  const range = (value: { start: Position; end: Position }) => ({ start: offset(value.start), end: offset(value.end) });

  return { document, range };
};
