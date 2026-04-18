import { Excalidraw } from '@excalidraw/excalidraw';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type SceneResponse = {
  path: string;
  basename: string;
  isNewFile: boolean;
  scene: {
    elements?: readonly unknown[];
    appState?: Partial<AppState>;
    files?: BinaryFiles;
  };
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const sceneRef = useRef<SceneResponse | null>(null);
  const [initialData, setInitialData] = useState<SceneResponse['scene'] | null>(null);
  const [basename, setBasename] = useState('drawing.excalidraw');
  const [status, setStatus] = useState<SaveState>('idle');
  const [message, setMessage] = useState('Loading scene...');

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/scene');
      if (!response.ok) {
        throw new Error(`Load failed: ${response.status}`);
      }

      const data = (await response.json()) as SceneResponse;
      sceneRef.current = data;
      setInitialData(data.scene);
      setBasename(data.basename);
      setMessage(data.isNewFile ? 'New file. Save to write first scene.' : 'Scene loaded.');
    };

    load().catch((error: unknown) => {
      console.error(error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to load scene');
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveScene();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const saveScene = async () => {
    const api = apiRef.current;
    if (!api) {
      setStatus('error');
      setMessage('Editor not ready yet.');
      return;
    }

    setStatus('saving');
    setMessage('Saving...');

    const payload = {
      elements: api.getSceneElementsIncludingDeleted(),
      appState: api.getAppState(),
      files: api.getFiles(),
    };

    try {
      const response = await fetch('/api/scene', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      const data = (await response.json()) as { basename: string; savedAt: string };
      setBasename(data.basename);
      setStatus('saved');
      setMessage(`Saved ${new Date(data.savedAt).toLocaleTimeString()}`);
    } catch (error: unknown) {
      console.error(error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Save failed');
    }
  };

  if (!initialData) {
    return (
      <div className="shell">
        <div className="loading-card">{message}</div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="meta">
          <strong>{basename}</strong>
          <span>{message}</span>
        </div>
        <button className={`save-button ${status}`} onClick={() => void saveScene()}>
          {status === 'saving' ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="canvas">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          initialData={initialData as any}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
            },
          }}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
