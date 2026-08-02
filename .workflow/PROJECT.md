# Ski AI Concierge

## Overview

Un assistente conversazionale con avatar 3D che un negozio di noleggio e vendita
di attrezzatura sciistica mette sul proprio sito. Lo sciatore gli parla o gli
scrive come parlerebbe all'addetto al banco: dice che livello ha, quanto pesa,
dove scia — e riceve un consiglio sull'attrezzatura, la disponibilità reale per
le sue date, il prezzo e, se vuole, la prenotazione.

È una POC: dimostra che la competenza del negozio può stare online senza
diventare un modulo da compilare.

## Audience

**Cliente pagante:** negozi di noleggio e vendita attrezzatura sciistica in
località alpine — tipicamente una o due sedi, 300–1500 pezzi a magazzino, un
sito con un modulo di prenotazione che nessuno ha voglia di mantenere. Vendono
per due stagioni corte l'anno e in alta stagione il banco è la strozzatura.

**Utente finale:** lo sciatore che prenota online prima di partire. Sa dove va e
quando, non sa che sci gli servono. Oggi sceglie a caso, o telefona, o rimanda
tutto al banco.

## Problem & current alternatives

Il valore di un noleggio sci sta nella consulenza: la lunghezza giusta per
altezza, peso e livello, il flex dello scarpone, la differenza fra un all-mountain
e un piste. Quella competenza vive nella testa di chi sta al banco.

Online, invece, resta fuori. Il cliente compila un modulo con categoria, taglia e
date — cioè decide da solo proprio le cose su cui avrebbe bisogno di aiuto.
Le conseguenze le paga il negozio: cambi al banco in alta stagione, code, clienti
che arrivano con la scelta sbagliata, e un carrello medio più basso di quanto
sarebbe stato con una proposta fatta bene.

Le alternative di oggi: moduli di prenotazione (Skiset, Sportrent e simili),
chatbot FAQ che non vedono il magazzino, oppure il telefono.

## Value proposition

**Porta online la consulenza del banco, non il modulo di prenotazione.**

Il concierge fa le domande che farebbe l'addetto — livello, altezza, peso, stile
di sciata — e da lì propone un setup concreto, verificato sulla disponibilità
reale e sul listino vero. La conversazione arriva alla prenotazione; non parte da
un menu a tendina. Per il negozio significa vendere meglio e togliere lavoro al
banco nelle settimane in cui il banco è pieno.

## Success criteria (6 months)

Il traguardo dichiarato dei sei mesi è **una demo che regge davanti a un
investitore**. Tradotto in segnali verificabili:

- Una conversazione completa — consiglio, disponibilità, prezzo, prenotazione —
  gira dal vivo senza inceppi, a voce e per iscritto.
- L'assistente non inventa mai un prezzo o una disponibilità: ogni numero
  mostrato è tracciabile a una chiamata di tool. Verificato dagli eval.
- L'avatar resta credibile per tutta la conversazione: stati coerenti, lip sync
  sincrono, nessun blocco visibile.
- L'architettura regge la domanda "e per venderlo a cento negozi?": multi-tenant,
  auth e pagamenti si innestano senza riscrivere il nucleo.

**Tensione da tenere presente:** l'acquirente è il negozio, ma la soglia dei sei
mesi è la qualità percepita davanti a un investitore. Dove le due cose divergono,
la POC privilegia la solidità del flusso di consulenza — che è insieme la cosa
che vende al negozio e la cosa che si dimostra meglio in una demo.

## Out of scope

Pagamenti, autenticazione, back-office per il negozio, multi-tenant,
sincronizzazione col magazzino reale, notifiche. Ne parliamo quando ci sono
negozi pilota veri, non prima.
