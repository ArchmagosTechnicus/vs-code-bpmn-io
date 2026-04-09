import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import url from '@rollup/plugin-url';
import typescript from '@rollup/plugin-typescript';

import css from 'rollup-plugin-css-only';

const appExternal = [ 'vscode' ];

const appPlugins = [
  typescript(),
  resolve(),
  commonjs()
];

function appBuild(input, file) {
  return {
    input,
    output: {
      sourcemap: true,
      format: 'commonjs',
      file
    },
    external: appExternal,
    plugins: appPlugins,
    watch: {
      clearScreen: false
    }
  };
}

export default [

  // client
  {
    input: 'src/client/bpmn-editor.js',
    output: {
      sourcemap: true,
      format: 'iife',
      file: './out/client/bpmn-editor.js'
    },
    plugins: [
      url({
        fileName: '[dirname][filename][extname]',
        publicPath: '/media/'
      }),

      css({ output: 'bpmn-editor.css' }),

      resolve(),
      commonjs()
    ],
    watch: {
      clearScreen: false
    }
  },

  // app
  appBuild('src/dispose.ts', './out/dispose.js'),

  // app
  appBuild('src/util.ts', './out/util.js'),

  // app
  appBuild('src/bpmn-editor.ts', './out/bpmn-editor.js'),

  // app
  appBuild('src/extension.ts', './out/extension.js')
];
