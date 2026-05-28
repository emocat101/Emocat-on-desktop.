import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Cat,
  Eye,
  EyeOff,
  Hand,
  Import,
  MessageCircle,
  Moon,
  MousePointer2,
  PanelRightOpen,
  Play,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Sun,
  Volume2
} from 'lucide-react';
import { AppConfig, PetAction, PetAsset, PetMode, UpdateConfigResult, WindowPosition } from '../shared/types';
import { installPreviewApi } from './previewApi';
import './styles.css';

installPreviewApi();

interface AppState {
  config: AppConfig | null;
  pets: PetAsset[];
  loading: boolean;
}

type TabId = 'overview' | 'assets' | 'interaction' | 'speech' | 'display';

const modeLabels: Record<PetMode, string> = {
  companion: '陪伴模式',
  sleep: '睡觉模式',
  active: '活跃模式',
  quiet: '安静模式'
};

const modeIcons: Record<PetMode, React.ReactNode> = {
  companion: <Cat size={18} />,
  sleep: <Moon size={18} />,
  active: <Sparkles size={18} />,
  quiet: <Volume2 size={18} />
};

function App() {
  const route = window.location.hash.replace('#/', '') || 'pet';
  const [state, setState] = useState<AppState>({ config: null, pets: [], loading: true });

  const refresh = useCallback(async () => {
    const [config, pets] = await Promise.all([
      window.desktopPet.getConfig(),
      window.desktopPet.listPetAssets()
    ]);
    setState({ config, pets, loading: false });
  }, []);

  useEffect(() => {
    void refresh();
    return window.desktopPet.onConfigChanged((payload: UpdateConfigResult) => {
      setState((current) => ({
        config: payload.config,
        pets: payload.pets.length ? payload.pets : current.pets,
        loading: false
      }));
    });
  }, [refresh]);

  if (state.loading || !state.config) {
    return <div className={route === 'pet' ? 'pet-loading transparent' : 'pet-loading'}>喵...</div>;
  }

  if (route === 'settings') {
    return <SettingsPanel config={state.config} pets={state.pets} onRefresh={refresh} />;
  }

  return <PetWindow config={state.config} pets={state.pets} />;
}

function PetWindow({ config, pets }: { config: AppConfig; pets: PetAsset[] }) {
  const activePet = pets.find((pet) => pet.id === config.pet.activePetId) ?? pets[0];
  const [actionName, setActionName] = useState(resolveModeAction(config.pet.mode));
  const [bubble, setBubble] = useState(randomLine(config.speech.greetings));
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPointer = useRef<WindowPosition | null>(null);
  const clickTimer = useRef<number | null>(null);

  const action = useMemo(() => {
    return activePet?.actions.find((item) => item.name === actionName)
      ?? activePet?.actions.find((item) => item.name === 'idle')
      ?? null;
  }, [activePet, actionName]);

  useEffect(() => {
    setActionName(resolveModeAction(config.pet.mode));
  }, [config.pet.mode]);

  useEffect(() => {
    const seconds = Math.max(10, config.interactions.idleAfterSeconds);
    const timer = window.setInterval(() => {
      if (config.pet.mode === 'quiet') {
        return;
      }
      const idleActions = config.pet.mode === 'active' ? ['happy', 'walk', 'idle'] : ['idle', 'sleep'];
      setActionName(pickExistingAction(activePet, idleActions));
      setBubble(randomLine(config.speech.idle));
    }, seconds * 1000);

    return () => window.clearInterval(timer);
  }, [activePet, config.interactions.idleAfterSeconds, config.pet.mode, config.speech.idle]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragOffset.current = { x: event.clientX, y: event.clientY };
    lastPointer.current = { x: event.screenX - event.clientX, y: event.screenY - event.clientY };
    setDragging(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const next = {
      x: event.screenX - dragOffset.current.x,
      y: event.screenY - dragOffset.current.y
    };
    const moved = !lastPointer.current
      || Math.abs(next.x - lastPointer.current.x) > 3
      || Math.abs(next.y - lastPointer.current.y) > 3;

    if (moved) {
      setDragging(true);
      lastPointer.current = next;
      void window.desktopPet.movePet(next);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (lastPointer.current && dragging) {
      void window.desktopPet.savePosition(lastPointer.current);
    }
    window.setTimeout(() => setDragging(false), 0);
  };

  const handleClick = () => {
    if (dragging) {
      return;
    }

    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      triggerInteraction(config.interactions.doubleClickAction);
      return;
    }

    clickTimer.current = window.setTimeout(() => {
      triggerInteraction(config.interactions.clickAction);
      clickTimer.current = null;
    }, 180);
  };

  const triggerInteraction = (nextAction: string) => {
    setActionName(pickExistingAction(activePet, [nextAction, 'happy', 'touch', 'idle']));
    setBubble(randomLine(config.speech.interactions));
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (config.interactions.rightClickOpensMenu) {
      void window.desktopPet.showSettings();
    }
  };

  return (
    <main className="pet-stage" style={{ '--pet-size': `${config.display.size}px` } as React.CSSProperties}>
      {config.display.bubbleEnabled && bubble && (
        <div className="speech-bubble" aria-live="polite">{bubble}</div>
      )}
      <div
        className={`pet-hitbox mode-${config.pet.mode}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <ActionPlayer action={action} mode={config.pet.mode} size={config.display.size} />
      </div>
    </main>
  );
}

function SettingsPanel({ config, pets, onRefresh }: { config: AppConfig; pets: PetAsset[]; onRefresh: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const activePet = pets.find((pet) => pet.id === config.pet.activePetId) ?? pets[0];

  const update = async (patch: Parameters<typeof window.desktopPet.updateConfig>[0]) => {
    await window.desktopPet.updateConfig(patch);
    await onRefresh();
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: '概览', icon: <PanelRightOpen size={18} /> },
    { id: 'assets', label: '素材', icon: <Import size={18} /> },
    { id: 'interaction', label: '互动', icon: <Hand size={18} /> },
    { id: 'speech', label: '语句', icon: <MessageCircle size={18} /> },
    { id: 'display', label: '显示', icon: <Settings size={18} /> }
  ];

  return (
    <main className="settings-shell">
      <aside className="settings-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Cat size={24} /></div>
          <div>
            <h1>猫猫桌面宠物</h1>
            <p>本地后台</p>
          </div>
        </div>
        <nav className="tab-list">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.id ? 'tab-button active' : 'tab-button'}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="settings-content">
        {activeTab === 'overview' && (
          <OverviewTab config={config} pets={pets} activePet={activePet} onUpdate={update} />
        )}
        {activeTab === 'assets' && (
          <AssetsTab config={config} pets={pets} activePet={activePet} onRefresh={onRefresh} onUpdate={update} />
        )}
        {activeTab === 'interaction' && (
          <InteractionTab config={config} activePet={activePet} onUpdate={update} />
        )}
        {activeTab === 'speech' && (
          <SpeechTab config={config} onUpdate={update} />
        )}
        {activeTab === 'display' && (
          <DisplayTab config={config} onUpdate={update} />
        )}
      </section>
    </main>
  );
}

function OverviewTab({
  config,
  pets,
  activePet,
  onUpdate
}: {
  config: AppConfig;
  pets: PetAsset[];
  activePet?: PetAsset;
  onUpdate: (patch: Parameters<typeof window.desktopPet.updateConfig>[0]) => Promise<void>;
}) {
  return (
    <div className="panel-grid overview-grid">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">当前小猫</p>
          <h2>{activePet?.name ?? '默认猫猫'}</h2>
          <p>{activePet?.description ?? '内置动态猫猫，支持后续替换素材包。'}</p>
        </div>
        <div className="preview-plate">
          <ActionPlayer action={activePet?.actions.find((item) => item.name === 'idle') ?? null} mode={config.pet.mode} size={180} />
        </div>
      </section>

      <section className="control-band">
        <div className="section-heading">
          <h3>状态</h3>
          <button className="icon-button" title="刷新" type="button" onClick={() => window.location.reload()}>
            <RotateCcw size={18} />
          </button>
        </div>
        <div className="metric-row">
          <Metric label="素材包" value={String(pets.length)} />
          <Metric label="尺寸" value={`${config.display.size}px`} />
          <Metric label="透明度" value={`${Math.round(config.display.opacity * 100)}%`} />
        </div>
        <div className="mode-grid">
          {(Object.keys(modeLabels) as PetMode[]).map((mode) => (
            <button
              className={config.pet.mode === mode ? 'mode-button active' : 'mode-button'}
              key={mode}
              type="button"
              onClick={() => onUpdate({ pet: { mode } })}
            >
              {modeIcons[mode]}
              {modeLabels[mode]}
            </button>
          ))}
        </div>
        <button
          className={config.pet.enabled ? 'primary-action' : 'primary-action muted'}
          type="button"
          onClick={() => onUpdate({ pet: { enabled: !config.pet.enabled } })}
        >
          {config.pet.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
          {config.pet.enabled ? '小猫显示中' : '小猫已隐藏'}
        </button>
      </section>
    </div>
  );
}

function AssetsTab({
  config,
  pets,
  activePet,
  onRefresh,
  onUpdate
}: {
  config: AppConfig;
  pets: PetAsset[];
  activePet?: PetAsset;
  onRefresh: () => Promise<void>;
  onUpdate: (patch: Parameters<typeof window.desktopPet.updateConfig>[0]) => Promise<void>;
}) {
  const [previewActionName, setPreviewActionName] = useState('idle');
  const previewAction = activePet?.actions.find((item) => item.name === previewActionName)
    ?? activePet?.actions[0]
    ?? null;

  const importAsset = async () => {
    await window.desktopPet.importPetAsset();
    await onRefresh();
  };

  return (
    <div className="panel-grid asset-grid">
      <section className="control-band">
        <div className="section-heading">
          <h2>素材包</h2>
          <button className="primary-action compact" type="button" onClick={importAsset}>
            <Import size={18} />
            导入
          </button>
        </div>
        <div className="asset-list">
          {pets.map((pet) => (
            <button
              className={config.pet.activePetId === pet.id ? 'asset-row active' : 'asset-row'}
              key={`${pet.source}-${pet.id}`}
              type="button"
              onClick={() => onUpdate({ pet: { activePetId: pet.id } })}
            >
              <div>
                <strong>{pet.name}</strong>
                <span>{pet.source === 'built-in' ? '内置' : '本地'} · {pet.actions.length} 个动作</span>
              </div>
              <Play size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="control-band">
        <div className="section-heading">
          <h2>动作预览</h2>
          <span className="pill">{activePet?.name ?? '无素材'}</span>
        </div>
        <div className="preview-plate wide">
          <ActionPlayer action={previewAction} mode={config.pet.mode} size={210} />
        </div>
        <div className="action-chip-row">
          {activePet?.actions.map((action) => (
            <button
              className={previewActionName === action.name ? 'action-chip active' : 'action-chip'}
              key={action.name}
              type="button"
              onClick={() => setPreviewActionName(String(action.name))}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function InteractionTab({
  config,
  activePet,
  onUpdate
}: {
  config: AppConfig;
  activePet?: PetAsset;
  onUpdate: (patch: Parameters<typeof window.desktopPet.updateConfig>[0]) => Promise<void>;
}) {
  const actionOptions = activePet?.actions.length ? activePet.actions : [];

  return (
    <div className="control-stack">
      <section className="control-band">
        <h2>互动动作</h2>
        <div className="form-grid">
          <SelectField
            label="点击"
            value={String(config.interactions.clickAction)}
            options={actionOptions}
            onChange={(value) => onUpdate({ interactions: { clickAction: value } })}
          />
          <SelectField
            label="双击"
            value={String(config.interactions.doubleClickAction)}
            options={actionOptions}
            onChange={(value) => onUpdate({ interactions: { doubleClickAction: value } })}
          />
          <SliderField
            label="空闲触发"
            value={config.interactions.idleAfterSeconds}
            min={10}
            max={180}
            unit="秒"
            onChange={(value) => onUpdate({ interactions: { idleAfterSeconds: value } })}
          />
        </div>
      </section>

      <section className="control-band">
        <h2>互动开关</h2>
        <div className="toggle-row">
          <Toggle
            label="右键打开后台"
            checked={config.interactions.rightClickOpensMenu}
            onChange={(checked) => onUpdate({ interactions: { rightClickOpensMenu: checked } })}
          />
          <Toggle
            label="跟随鼠标"
            checked={config.interactions.followCursor}
            onChange={(checked) => onUpdate({ interactions: { followCursor: checked } })}
          />
        </div>
      </section>
    </div>
  );
}

function SpeechTab({
  config,
  onUpdate
}: {
  config: AppConfig;
  onUpdate: (patch: Parameters<typeof window.desktopPet.updateConfig>[0]) => Promise<void>;
}) {
  const [greetings, setGreetings] = useState(config.speech.greetings.join('\n'));
  const [interactions, setInteractions] = useState(config.speech.interactions.join('\n'));
  const [idle, setIdle] = useState(config.speech.idle.join('\n'));

  useEffect(() => {
    setGreetings(config.speech.greetings.join('\n'));
    setInteractions(config.speech.interactions.join('\n'));
    setIdle(config.speech.idle.join('\n'));
  }, [config.speech]);

  const save = () => onUpdate({
    speech: {
      greetings: splitLines(greetings),
      interactions: splitLines(interactions),
      idle: splitLines(idle)
    }
  });

  return (
    <div className="control-stack">
      <section className="control-band">
        <div className="section-heading">
          <h2>语句</h2>
          <button className="primary-action compact" type="button" onClick={save}>
            <Save size={18} />
            保存
          </button>
        </div>
        <div className="text-grid">
          <TextAreaField label="问候语" value={greetings} onChange={setGreetings} />
          <TextAreaField label="互动语句" value={interactions} onChange={setInteractions} />
          <TextAreaField label="空闲语句" value={idle} onChange={setIdle} />
        </div>
      </section>
    </div>
  );
}

function DisplayTab({
  config,
  onUpdate
}: {
  config: AppConfig;
  onUpdate: (patch: Parameters<typeof window.desktopPet.updateConfig>[0]) => Promise<void>;
}) {
  return (
    <div className="control-stack">
      <section className="control-band">
        <h2>显示</h2>
        <div className="form-grid">
          <SliderField
            label="桌宠大小"
            value={config.display.size}
            min={96}
            max={320}
            unit="px"
            onChange={(value) => onUpdate({ display: { size: value } })}
          />
          <SliderField
            label="透明度"
            value={Math.round(config.display.opacity * 100)}
            min={35}
            max={100}
            unit="%"
            onChange={(value) => onUpdate({ display: { opacity: value / 100 } })}
          />
        </div>
      </section>
      <section className="control-band">
        <h2>偏好</h2>
        <div className="toggle-row">
          <Toggle
            label="显示气泡"
            checked={config.display.bubbleEnabled}
            onChange={(checked) => onUpdate({ display: { bubbleEnabled: checked } })}
          />
          <Toggle
            label="开机启动"
            checked={config.display.startAtLogin}
            onChange={(checked) => onUpdate({ display: { startAtLogin: checked } })}
          />
        </div>
      </section>
    </div>
  );
}

function ActionPlayer({ action, mode, size }: { action: PetAction | null; mode: PetMode; size: number }) {
  const [frame, setFrame] = useState(0);
  const files = action?.files ?? [];
  const type = action?.type ?? 'generated';

  useEffect(() => {
    setFrame(0);
    if (type !== 'sprite' || files.length <= 1) {
      return;
    }

    const delay = Math.max(60, 1000 / Math.max(1, action?.fps ?? 8));
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % files.length);
    }, delay);

    return () => window.clearInterval(timer);
  }, [action?.fps, files.length, type]);

  if (type === 'animated' && files[0]) {
    return <img className="pet-image" alt="" src={files[0]} style={{ width: size, height: size }} draggable={false} />;
  }

  if (type === 'sprite' && files.length) {
    return <img className="pet-image" alt="" src={files[frame]} style={{ width: size, height: size }} draggable={false} />;
  }

  return <CssCat mode={mode} size={size} actionName={String(action?.name ?? 'idle')} />;
}

function CssCat({ mode, size, actionName }: { mode: PetMode; size: number; actionName: string }) {
  return (
    <div className={`css-cat cat-${mode} action-${actionName}`} style={{ width: size, height: size }}>
      <div className="tail" />
      <div className="body">
        <div className="spot spot-one" />
        <div className="spot spot-two" />
      </div>
      <div className="head">
        <div className="ear left" />
        <div className="ear right" />
        <div className="face">
          <span className="eye left" />
          <span className="eye right" />
          <span className="nose" />
          <span className="mouth" />
          <span className="whisker left top" />
          <span className="whisker left bottom" />
          <span className="whisker right top" />
          <span className="whisker right bottom" />
        </div>
      </div>
      <div className="paw left" />
      <div className="paw right" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: PetAction[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.name} value={option.name}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  unit,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => setLocalValue(value), [value]);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          value={localValue}
          onChange={(event) => setLocalValue(Number(event.target.value))}
          onMouseUp={() => onChange(localValue)}
          onTouchEnd={() => onChange(localValue)}
        />
        <strong>{localValue}{unit}</strong>
      </div>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-track" />
      <span>{label}</span>
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field textarea-field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
    </label>
  );
}

function resolveModeAction(mode: PetMode) {
  if (mode === 'sleep') {
    return 'sleep';
  }
  if (mode === 'active') {
    return 'happy';
  }
  return 'idle';
}

function pickExistingAction(pet: PetAsset | undefined, preferred: string[]) {
  const names = new Set(pet?.actions.map((action) => action.name) ?? []);
  return preferred.find((name) => names.has(name)) ?? 'idle';
}

function randomLine(lines: string[]) {
  if (!lines.length) {
    return '';
  }
  return lines[Math.floor(Math.random() * lines.length)];
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
