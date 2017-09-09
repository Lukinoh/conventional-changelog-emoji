'use strict';
var compareFunc = require('compare-func');
var Q = require('q');
var readFile = Q.denodeify(require('fs').readFile);
var resolve = require('path').resolve;

var parserOpts = {
  headerPattern: /^(..?) (\w*)(?:\((.*)\))?\: (.*)$/,
  headerCorrespondence: [
    'emoji',
    'type',
    'scope',
    'subject'
  ],
  noteKeywords: ['BREAKING CHANGE', 'BREAKING CHANGES'],
  revertPattern: /^revert:\s([\s\S]*?)\s*This reverts commit (\w*)\./,
  revertCorrespondence: ['header', 'hash']
};

var writerOpts = {
  transform: function(commit, context) {
    var discard = true;
    var issues = [];

    commit.notes.forEach(function(note) {
      note.title = 'BREAKING CHANGES';
      discard = false;
    });

    if (commit.type === 'feat') {
      commit.type = commit.emoji + ' Features';
    } else if (commit.type === 'fix') {
      commit.type = commit.emoji + ' Bug Fixes';
    } else if (commit.type === 'docs') {
      commit.type = commit.emoji + ' Documentation';
    } else if (commit.type === 'style') {
      commit.type = commit.emoji + ' Styles';
    } else if (commit.type === 'refactor') {
      commit.type = commit.emoji + ' Code Refactoring';
    } else if (commit.type === 'perf') {
      commit.type = commit.emoji + ' Performance Improvements';
    } else if (commit.type === 'test') {
      commit.type = commit.emoji + ' Tests';
    } else if (commit.type === 'build') {
      commit.type = commit.emoji + ' Build';
    } else if (commit.type === 'ci') {
      commit.type = commit.emoji + ' Continuous Integration';
    } else if (commit.type === 'chore') {
      commit.type = commit.emoji + ' Chores';
    } else if (commit.type === 'revert') {
      commit.type = commit.emoji + ' Reverts';
    } else if (discard) {
      return;
    }

    if (commit.scope === '*') {
      commit.scope = '';
    }

    if (typeof commit.hash === 'string') {
      commit.hash = commit.hash.substring(0, 7);
    }

    if (typeof commit.subject === 'string') {
      var url = context.repository ?
        context.host + '/' + context.owner + '/' + context.repository :
        context.repoUrl;
      if (url) {
        url = url + '/issues/';
        // Issue URLs.
        commit.subject = commit.subject.replace(/#([0-9]+)/g, function(_, issue) {
          issues.push(issue);
          return '[#' + issue + '](' + url + issue + ')';
        });
      }
      if (context.host) {
        // User URLs.
        commit.subject = commit.subject.replace(/\B@([a-z0-9](?:-?[a-z0-9]){0,38})/g, '[@$1](' + context.host + '/$1)');
      }
    }

    // remove references that already appear in the subject
    commit.references = commit.references.filter(function(reference) {
      if (issues.indexOf(reference.issue) === -1) {
        return true;
      }

      return false;
    });

    return commit;
  },
  groupBy: 'type',
  commitGroupsSort: 'title',
  commitsSort: ['scope', 'subject'],
  noteGroupsSort: 'title',
  notesSort: compareFunc
};

module.exports = Q.all([
  readFile(resolve(__dirname, 'templates/template.hbs'), 'utf-8'),
  readFile(resolve(__dirname, 'templates/header.hbs'), 'utf-8'),
  readFile(resolve(__dirname, 'templates/commit.hbs'), 'utf-8'),
  readFile(resolve(__dirname, 'templates/footer.hbs'), 'utf-8')
])
  .spread(function(template, header, commit, footer) {

    writerOpts.mainTemplate = template;
    writerOpts.headerPartial = header;
    writerOpts.commitPartial = commit;
    writerOpts.footerPartial = footer;

    return {
      parserOpts: parserOpts,
      writerOpts: writerOpts
    };
  });
