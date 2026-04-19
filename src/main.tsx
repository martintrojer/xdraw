import { Excalidraw, restore, serializeAsJSON, THEME } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type SceneResponse = {
  path: string;
  basename: string;
  isNewFile: boolean;
  scene: {
    elements?: readonly ExcalidrawElement[];
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
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [status, setStatus] = useState<SaveState>('idle');
  const [message, setMessage] = useState('Loading scene...');

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/api/scene');
      if (!response.ok) {
        throw new Error(`Load failed: ${response.status}`);
      }

      const data = (await response.json()) as SceneResponse;
      const restored = restore(
        {
          ...data.scene,
          appState: {
            ...data.scene.appState,
            collaborators: undefined,
            showWelcomeScreen: false,
          },
        },
        null,
        null
      );
      sceneRef.current = data;
      setInitialData(restored);
      setBasename(data.basename);
      setIsDarkMode(data.scene.appState?.theme !== 'light');
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

    const payload = JSON.parse(
      serializeAsJSON(
        api.getSceneElementsIncludingDeleted(),
        api.getAppState(),
        api.getFiles(),
        'local'
      )
    );

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
    <div className={`shell ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="topbar">
        <div className="meta">
          <strong>{basename}</strong>
          <span>{message}</span>
        </div>
        <div className="actions">
          <button
            className="theme-toggle"
            onClick={() => {
              setIsDarkMode((current) => !current);
            }}
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
          <button className={`save-button ${status}`} onClick={() => void saveScene()}>
            {status === 'saving' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <div className="canvas">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          initialData={initialData as any}
          theme={isDarkMode ? THEME.DARK : THEME.LIGHT}
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
