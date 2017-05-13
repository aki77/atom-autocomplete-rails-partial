'use babel';

import glob from 'glob';
import sortby from 'lodash.sortby';

const SELECTOR = ['.source.ruby .string'];
const LINE_REGEXP = /[^a-z.]render(?:\s+|\()['"]([a-zA-Z0-9_/]*)$/;

const getPartialPaths = () =>
  new Promise((resolve) => {
    const options = {
      cwd: atom.project.getPaths()[0],
    };
    glob('app/views/**/_*', options, (err, files) => {
      resolve(files);
    });
  });

const suggestionForRelativePath = relativePaths =>
  relativePaths.map((relativePath) => {
    const viewPath = relativePath.replace('app/views/', '');
    const parts = viewPath.split('/');
    const fileName = parts[parts.length - 1];
    const [baseName, type] = fileName.split('.', 3);
    const partialPath = [...parts.slice(0, -1), baseName.slice(1)].join('/');
    return {
      text: partialPath,
      type: 'keyword',
      rightLabel: type,
      description: viewPath,
    };
  });

const matchScore = (path1, path2) => {
  const dirname1 = path1.split('/').slice(0, -1).join('/');
  const dirname2 = path2.split('/').slice(0, -1).join('/');

  let score = 0;
  for (let i = 0; i < dirname1.length; i++) {
    if (dirname1[i] !== dirname2[i]) break;
    score += 1;
  }

  return score;
};

const provider = {
  selector: SELECTOR.join(', '),
  filterSuggestions: true,
  suggestionPriority: 5,

  getSuggestions: ({ editor, bufferPosition, activatedManually }) => {
    const line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition]);
    const matches = line.match(LINE_REGEXP);
    if (!matches) {
      return [];
    }
    const [, replacementPrefix] = matches;

    // NOTE: fix bracket-matcher
    if (replacementPrefix.length === 0 && !activatedManually) {
      setTimeout(() => {
        atom.commands.dispatch(atom.views.getView(editor), 'autocomplete-plus:activate');
      }, 10);
    }

    const [, projectRelativePath] = atom.project.relativizePath(editor.getPath());
    const currentViewPath = projectRelativePath.replace('app/views/', '');

    return getPartialPaths()
      .then(suggestionForRelativePath)
      .then(suggestions =>
        suggestions.map(suggestion =>
          Object.assign({}, suggestion, {
            sortScore: matchScore(currentViewPath, suggestion.description),
            replacementPrefix,
          }),
        ),
      )
      .then(suggestions => sortby(suggestions, 'sortScore').reverse());
  },
};

export default {
  getProvider() {
    return provider;
  },
};
