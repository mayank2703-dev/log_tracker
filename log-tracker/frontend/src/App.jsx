import { useEffect } from 'react';
import Header from './components/Header.jsx';
import SourcePicker from './components/SourcePicker.jsx';
import TimeRange from './components/TimeRange.jsx';
import Toolbar from './components/Toolbar.jsx';
import ModeStrip from './components/ModeStrip.jsx';
import LogViewer from './components/LogViewer.jsx';
import Footer from './components/Footer.jsx';
import { initNet } from './net/net.js';
import { useHistory } from './hooks/useHistory.js';

export default function App() {
  const { status, run } = useHistory();

  useEffect(() => {
    initNet();
  }, []);

  return (
    <div className="app">
      <Header />
      <SourcePicker />
      <TimeRange onSearch={run} status={status} />
      <Toolbar />
      <ModeStrip />
      <LogViewer />
      <Footer />
    </div>
  );
}
