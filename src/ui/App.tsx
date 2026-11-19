import { useEffect, useState } from 'react';
import { Cards } from './Cards';
import { Cram } from './Cram';
import { Home } from './Home';
import { Study } from './Study';
import { Test } from './Test';
import { ToFinish } from './ToFinish';
import { useUpdate } from './updates';

type Screen =
  | { name: 'home' }
  | { name: 'study'; topic?: string | undefined; focus?: string[] | undefined }
  | { name: 'cards' | 'test' | 'cram' | 'finish' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [key, setKey] = useState(0);
  const update = useUpdate();

  const go = (s: Screen) => {
    if (screen.name === 'home' && s.name !== 'home') history.pushState({ ops: 1 }, '');
    setScreen(s);
    setKey((k) => k + 1);
    window.scrollTo(0, 0);
  };
  const home = () => {
    if (history.state?.ops) history.back();
    else go({ name: 'home' });
  };
  // The phone's back swipe returns to Home instead of leaving the app.
  useEffect(() => {
    const onPop = () => (setScreen({ name: 'home' }), window.scrollTo(0, 0));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <>
      {screen.name === 'home' && <Home go={go} />}
      {screen.name === 'study' && <Study key={key} topic={screen.topic} focus={screen.focus} onBack={home} />}
      {screen.name === 'cards' && <Cards onBack={home} />}
      {screen.name === 'test' && <Test onBack={home} onStudyMisses={(ids) => (setScreen({ name: 'study', focus: ids }), setKey((k) => k + 1))} />}
      {screen.name === 'cram' && <Cram onBack={home} />}
      {screen.name === 'finish' && <ToFinish onBack={home} />}
      {update && (
        <button
          onClick={update}
          className="safe-bottom fixed inset-x-0 bottom-0 z-50 bg-[var(--tag-bg)] px-4 pt-3 text-center text-[15px] font-semibold text-[var(--tag)] shadow-[0_-4px_12px_rgba(0,0,0,0.15)]"
        >
          New questions available, tap to update
        </button>
      )}
    </>
  );
}
