"use client";

import { MessageSquareText, Send } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { useClientMessagesViewModel } from '../view-models/use-client-messages-view-model';

export function ClientMessagesView() {
  const vm = useClientMessagesViewModel();
  const clientInitials = vm.session?.name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase() ?? 'CL';
  const messages = vm.activeThread?.messages ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white font-black text-sm">PM</span>
        <div className="min-w-0 flex-1"><p className="text-sm font-black text-foreground">PMCM Events</p><p className="text-xs text-muted-foreground">{vm.selectedEvent ? `Chat for ${vm.selectedEvent.eventName}` : 'Your event coordination team'}</p></div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-success" />Active</span>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '420px' }}>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {vm.error ? <p className="text-sm text-destructive">{vm.error}</p> : vm.activeThread ? <>
            {vm.activeThread.messagesNextCursor ? <button type="button" className="text-xs text-primary" onClick={() => void vm.loadOlder()}>Load older messages</button> : null}
            {messages.map((message) => { const fromPmcm = message.senderRole !== 'client'; return <div key={message.id} className={`flex items-end gap-3 ${fromPmcm ? '' : 'flex-row-reverse'}`}><span className={`grid size-8 shrink-0 place-items-center rounded-full text-2xs font-black ${fromPmcm ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{fromPmcm ? 'PM' : clientInitials}</span><div className={`max-w-[72%] ${fromPmcm ? '' : 'items-end'} flex flex-col gap-1`}><div className={`rounded-2xl px-4 py-2.5 text-sm leading-5 ${fromPmcm ? 'rounded-bl-md bg-muted text-foreground' : 'rounded-br-md bg-primary text-white'}`}>{message.body}</div><span className="text-3xs text-muted-foreground/60">{message.senderRole} · {message.createdAt}</span></div></div>; })}
          </> : <div className="flex h-full flex-col items-center justify-center py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted"><MessageSquareText className="size-6 text-muted-foreground" /></span><h3 className="mt-4 text-base font-black text-foreground">No messages yet</h3><p className="mt-2 max-w-xs text-sm text-muted-foreground">Messaging becomes available when PMCM opens an event thread.</p></div>}
        </div>
        <div className="border-t border-border bg-muted/20 px-4 py-3"><div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"><Input placeholder="Message PMCM…" className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm" disabled={!vm.activeThread || vm.busy} value={vm.draft} onChange={(event) => vm.updateDraft(event.target.value)} /><button type="button" disabled={!vm.activeThread || !vm.draft.trim() || vm.busy} onClick={() => void vm.sendMessage()} className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/20 text-primary"><Send className="size-3.5" /></button></div><p className="mt-1.5 text-center text-3xs text-muted-foreground">{vm.activeThread ? 'Replies are event-scoped and visible to active participants.' : 'Messaging becomes available when PMCM opens an event thread.'}</p></div>
      </div>
    </div>
  );
}
