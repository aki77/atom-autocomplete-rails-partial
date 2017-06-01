'use babel';

import path from 'path';
import glob from 'glob';
import sortby from 'lodash.sortby';
import fuzzaldrinPlus from 'fuzzaldrin-plus';

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

const viewPathForRelativePath = relativePath =>
  relativePath.replace(`${path.join('app', 'views')}${path.sep}`, '');

const suggestionForRelativePath = (relativePath) => {
  const viewPath = viewPathForRelativePath(relativePath);
  const parts = viewPath.split(path.sep);
  const fileName = parts[parts.length - 1];
  const [baseName, type] = fileName.split('.', 3);
  const partialPath = [...parts.slice(0, -1), baseName.slice(1)].join(path.sep);
  return {
    text: partialPath,
    type: 'keyword',
    rightLabel: type,
    description: viewPath,
  };
};

const matchScore = (path1, path2) => {
  const parts1 = path1.split(path.sep).slice(0, -1);
  const parts2 = path2.split(path.sep).slice(0, -1);

  let score = 0;
  parts1.some((part, index) => {
    if (part === parts2[index]) {
      score += 1;
      return false;
    }
    return true;
  });

  return score;
};

const provider = {
  selector: SELECTOR.join(', '),
  suggestionPriority: 5,

  getSuggestions({ editor, bufferPosition, activatedManually }) {
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

    return this.buildSuggestions({ editor, replacementPrefix });
  },

  async buildSuggestions({ editor, replacementPrefix }) {
    const [, projectRelativePath] = atom.project.relativizePath(editor.getPath());
    const currentViewPath = viewPathForRelativePath(projectRelativePath);

    const autoShow = replacementPrefix.trim().length === 0;
    const partialPaths = await getPartialPaths();

    const suggestions = partialPaths
      .map(suggestionForRelativePath)
      .map(suggestion =>
        Object.assign({}, suggestion, {
          score: autoShow ? 1 : fuzzaldrinPlus.score(suggestion.text, replacementPrefix),
        }),
      )
      .filter(suggestion => suggestion.score > 0)
      .map(suggestion =>
        Object.assign({}, suggestion, {
          pathScore: matchScore(currentViewPath, suggestion.description),
          replacementPrefix,
        }),
      );

    return sortby(suggestions, ['pathScore', 'score']).reverse();
  },
};

export default {
  getProvider() {
    return provider;
  },
};
