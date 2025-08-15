/* global acquireVsCodeApi */

import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';

import './bpmn-editor.css';
import 'bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css';


import BpmnModeler from 'bpmn-js/lib/Modeler';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import { diff } from 'bpmn-js-differ';
import BpmnModdle from 'bpmn-moddle';

import TokenSimulationModule from 'bpmn-js-token-simulation';
import BpmnColorPickerModule from 'bpmn-js-color-picker';

import { handleMacOsKeyboard } from './utils/macos-keyboard';

/**
 * @type { import('vscode') }
 */
const vscode = acquireVsCodeApi();

handleMacOsKeyboard();

let isDiffMode = false;
let comparisonContent = null;

// Create both modeler and viewer for the left panel
const modeler = new BpmnModeler({
  container: '#canvas',
  additionalModules: [
    BpmnColorPickerModule,
    TokenSimulationModule
  ]
});

const leftViewer = new BpmnViewer({
  container: '#canvas'
});

const rightViewer = new BpmnViewer({
  container: '#canvas2'
});

// Function to switch between modeler and viewer
async function switchLeftPanel(useViewer) {
  const currentXML = await (useViewer ? modeler : leftViewer).saveXML();
  modeler.detach();
  leftViewer.detach();
  
  const activeEditor = useViewer ? leftViewer : modeler;
  activeEditor.attachTo('#canvas');
  await activeEditor.importXML(currentXML.xml);
  
  // Restore focus handling
  if (!useViewer) {
    activeEditor.on('canvas.focus.changed', (event) => {
      vscode.postMessage({
        type: 'canvas-focus-change',
        value: event.focused
      });
    });
  }
}

modeler.on('import.done', event => {
  return vscode.postMessage({
    type: 'import',
    error: event.error?.message,
    warnings: event.warnings.map(warning => warning.message),
    idx: -1
  });
});

modeler.on('commandStack.changed', () => {
  /**
   * @type { import('diagram-js/lib/command/CommandStack').default }
   */
  const commandStack = modeler.get('commandStack');

  return vscode.postMessage({
    type: 'change',
    idx: commandStack._stackIdx
  });
});

modeler.on('canvas.focus.changed', (event) => {
  return vscode.postMessage({
    type: 'canvas-focus-change',
    value: event.focused
  });
});

document.getElementById('toggle-diff').addEventListener('click', async () => {
  isDiffMode = !isDiffMode;
  
  const canvas2 = document.getElementById('canvas2');
  if (isDiffMode) {
    // Switch to viewer mode for left panel
    await switchLeftPanel(true);
    
    canvas2.classList.remove('hidden');
    if (!comparisonContent) {
      vscode.postMessage({ type: 'requestComparisonContent' });
    } else {
      await rightViewer.importXML(comparisonContent);
      highlightDifferences();
    }
  } else {
    // Switch back to modeler mode for left panel
    await switchLeftPanel(false);
    canvas2.classList.add('hidden');
  }
});

async function highlightDifferences() {
  const currentXml = await leftViewer.saveXML();
  const comparisonXml = await rightViewer.saveXML();
  
  // Parse XML to BPMN definitions using bpmn-moddle
  const moddle = new BpmnModdle();
  const { rootElement: currentDefinitions } = await moddle.fromXML(currentXml.xml);
  const { rootElement: comparisonDefinitions } = await moddle.fromXML(comparisonXml.xml);
  
  // Get changes using bpmn-js-differ
  const changes = diff(comparisonDefinitions, currentDefinitions);
  
  console.log('Diff changes:', {
    added: Object.keys(changes._added),
    removed: Object.keys(changes._removed),
    changed: Object.keys(changes._changed),
    layoutChanged: Object.keys(changes._layoutChanged)
  });

  // Helper function to log and add markers
  const addMarkers = (viewer, changes, type) => {
    const canvas = viewer.get('canvas');
    const elementIds = Object.keys(changes);
    const elements = elementIds.map(id => {
      const element = viewer.get('elementRegistry').get(id);
      return { id, found: !!element };
    });
    console.log(`Elements to highlight as ${type}:`, elements);
    
    // Add marker to each element individually
    elementIds.forEach(id => {
      const element = viewer.get('elementRegistry').get(id);
      if (element) {
        canvas.addMarker(element, `highlight-${type}`);
      }
    });
  };

  // Highlight changes in the left viewer (current version)
  addMarkers(leftViewer, changes._added, 'added');        // Show new elements in green
  addMarkers(leftViewer, changes._changed, 'changed');    // Show modified elements in orange
  addMarkers(leftViewer, changes._layoutChanged, 'layout'); // Show layout changes in blue

  // Highlight changes in the right viewer (comparison version)
  addMarkers(rightViewer, changes._removed, 'removed');   // Show removed elements in red
  addMarkers(rightViewer, changes._changed, 'changed');   // Show modified elements in orange
  addMarkers(rightViewer, changes._layoutChanged, 'layout'); // Show layout changes in blue
}


// handle messages from the extension
window.addEventListener('message', async (event) => {

  const {
    type,
    body,
    requestId
  } = event.data;

  switch (type) {
  case 'init':
    if (!body.content) {
      return modeler.createDiagram();
    } else {
      return modeler.importXML(body.content);
    }

  case 'update': {
    if (body.content) {
      return modeler.importXML(body.content);
    }

    if (body.undo) {
      return modeler.get('commandStack').undo();
    }

    if (body.redo) {
      return modeler.get('commandStack').redo();
    }

    break;
  }

  case 'getText':
    return modeler.saveXML({ format: true }).then(({ xml }) => {
      return vscode.postMessage({
        type: 'response',
        requestId,
        body: xml
      });
    });

  case 'focusCanvas':
    modeler.get('canvas').focus();
    return;

  case 'requestComparisonContent':
    comparisonContent = body.content;
    if (isDiffMode) {
      await rightViewer.importXML(comparisonContent);
      highlightDifferences();
    }
    return;
  }
});

// signal to VS Code that the webview is initialized
vscode.postMessage({ type: 'ready' });
