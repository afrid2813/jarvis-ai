import React, { Suspense } from 'react';
import ChartPanel from '../ChartPanel';
import ChatPanel from '../ChatPanel';
import SidePanel from '../SidePanel';
import TickerCard from '../TickerCard';

export default function MarketWorkspace({
  CompareTable,
  agentActive,
  agents,
  alerts,
  asset,
  assets,
  chatRef,
  clearChat,
  compareMode,
  fearAndGreed,
  headlines,
  headlinesLoading,
  input,
  lastSignal,
  latestTrace,
  loading,
  phase,
  phaseLabels,
  quickButtons,
  refreshHeadlines,
  removeAlert,
  removeFromWatchlist,
  riskLevel,
  selectAsset,
  selectedIdx,
  send,
  setInput,
  setPhase,
  setSelectedIdx,
  addAlert,
  addToWatchlist,
  swarmData,
  trades,
  watchlist,
  messages,
  evolutionState,
}) {
  return (
    <>
      <div className="tickers">
        {assets.map((item, index) => (
          <TickerCard
            key={item.symbol}
            asset={item}
            selected={index === selectedIdx}
            onClick={() => setSelectedIdx(index)}
          />
        ))}
      </div>

      {compareMode && (
        <Suspense fallback={<div className="skeleton-card" />}>
          <CompareTable assets={assets} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
        </Suspense>
      )}

      <div className="main-grid">
        <div className="main-column">
          <ChartPanel asset={asset} />
          <ChatPanel
            asset={asset}
            phase={phase}
            messages={messages}
            loading={loading}
            quickButtons={quickButtons}
            input={input}
            setInput={setInput}
            send={send}
            chatRef={chatRef}
            clearChat={clearChat}
          />
        </div>

        <SidePanel
          phase={phase}
          setPhase={setPhase}
          phaseLabels={phaseLabels}
          evolutionState={evolutionState}
          latestTrace={latestTrace}
          agents={agents}
          agentActive={agentActive}
          swarmData={swarmData}
          riskLevel={riskLevel}
          asset={asset}
          lastSignal={lastSignal}
          trades={trades}
          assets={assets}
          headlines={headlines}
          refreshHeadlines={refreshHeadlines}
          headlinesLoading={headlinesLoading}
          alerts={alerts}
          addAlert={addAlert}
          removeAlert={removeAlert}
          watchlist={watchlist}
          addToWatchlist={addToWatchlist}
          removeFromWatchlist={removeFromWatchlist}
          selectAsset={selectAsset}
          fearAndGreed={fearAndGreed}
        />
      </div>
    </>
  );
}
