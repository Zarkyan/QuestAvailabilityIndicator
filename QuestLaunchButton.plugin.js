/**
 * @name QuestLaunchButton
 * @author Nicolas, aamiaa (script original)
 * @description Premier clic : lancer les quêtes. Pendant l'exécution : afficher la console. Progression et estimation au survol.
 * @version 1.2.1
 */
// SPDX-License-Identifier: GPL-3.0-only
// Script fourni par l'utilisateur, adapté le 15 septembre 2026.
// Original : https://gist.github.com/aamiaa/204cd9d42013ded9faf646fae7f89fbb
// Adaptations : bouton, exécution unique, arrêt et restauration des méthodes.
const SESSION = Symbol.for('QuestLaunchButton.session');
module.exports = class QuestLaunchButton {
  start() {
    if (this.button?.isConnected) return;
    const button = this.button = document.createElement('button');
    button.type = 'button';
    button.id = 'quest-launch-button';
    button.hidden = true;
    button.textContent = '▶';
    button.setAttribute('aria-label', 'Lancer les quêtes');
    button.style.cssText = 'position:fixed;top:4px;right:224px;width:28px;height:24px;padding:0;border:1px solid #545862;border-radius:6px;background:#313338;color:#dbdee1;font:13px sans-serif;cursor:pointer;z-index:2147483646;-webkit-app-region:no-drag;';
    button.addEventListener('click', () => {
      if (!this.context?.active) { this.launch(); return; }
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'I',code:'KeyI',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));
    });
    document.body.append(button);
    this.createTooltip();
    this.updateVisibility();
    this.previousAvailableQuestIds = null;
    this.ensureQuestIndicator();
    this.questIndicatorTimer = globalThis.setInterval(() => this.refreshQuestIndicator(), 3000);
    this.refreshQuestIndicator();
  }
  findQuestsStore() {
    try {
      // Use the same Discord Webpack access path as the original launch code.
      const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, require => require]);
      webpackChunkdiscord_app.pop();
      const module = Object.values(wpRequire?.c ?? {}).find(item => item?.exports?.A?.__proto__?.getQuest);
      return module?.exports?.A ?? null;
    } catch (error) {
      globalThis.console.warn('[QuestLaunchButton] Store des quêtes indisponible', error);
      return null;
    }
  }
  ensureQuestIndicator() {
    if (!this.questIndicator) {
      const indicator = this.questIndicator = document.createElement('div');
      indicator.id = 'quest-launch-button-availability';
      indicator.setAttribute('role', 'status');
      indicator.style.cssText = 'position:fixed;top:4px;left:84px;z-index:2147483645;display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid #41434a;border-radius:8px;background:#232428;color:#f2f3f5;font:700 12px/1 sans-serif;white-space:nowrap;box-shadow:0 3px 12px #0005;pointer-events:none;-webkit-app-region:no-drag;';
      this.questIndicatorLight = document.createElement('span');
      this.questIndicatorLight.style.cssText = 'width:9px;height:9px;border-radius:50%;background:#949ba4;flex:none;';
      const label = document.createElement('span');
      label.textContent = 'Quêtes';
      this.questIndicatorCount = document.createElement('span');
      this.questIndicatorCount.textContent = '…';
      indicator.append(this.questIndicatorLight, label, this.questIndicatorCount);
      document.body.append(indicator);
    } else if (!this.questIndicator.isConnected) {
      document.body.append(this.questIndicator);
    }
  }
  refreshQuestIndicator() {
    this.ensureQuestIndicator();
    const store = this.questIndicatorStore?.quests ? this.questIndicatorStore : this.findQuestsStore();
    if (store?.quests) this.questIndicatorStore = store;
    const source = store?.quests;
    if (!source) { this.updateQuestIndicator(null, 'Chargement des quêtes'); return; }
    const quests = source.values ? [...source.values()] : Object.values(source);
    const now = Date.now();
    const available = quests.filter(quest => {
      const expiresAt = Date.parse(quest?.config?.expiresAt ?? '');
      return !quest?.userStatus?.enrolledAt && !quest?.userStatus?.completedAt && (!Number.isFinite(expiresAt) || expiresAt > now);
    });
    const ids = new Set(available.map(quest => quest?.id).filter(Boolean));
    if (this.previousAvailableQuestIds) {
      for (const quest of available.filter(item => item?.id && !this.previousAvailableQuestIds.has(item.id))) {
        const name = quest?.config?.messages?.questName || 'Nouvelle quête';
        globalThis.BdApi?.UI?.showToast?.(`Nouvelle quête disponible : ${name}`, {type:'success', timeout:8000});
      }
    }
    this.previousAvailableQuestIds = ids;
    const names = available.map(quest => quest?.config?.messages?.questName || 'Quête sans nom');
    this.updateQuestIndicator(available.length, names.join('\n'));
  }
  updateQuestIndicator(count, details) {
    if (!this.questIndicatorLight) return;
    const active = count !== null && count > 0;
    const color = active ? '#23a55a' : count === null ? '#f0b232' : '#949ba4';
    this.questIndicatorLight.style.backgroundColor = color;
    this.questIndicatorLight.style.boxShadow = active ? '0 0 8px #23a55a' : 'none';
    this.questIndicatorCount.textContent = count === null ? '…' : String(count);
    this.questIndicator.title = count === null ? 'Chargement des quêtes Discord' : count ? `${count} quête(s) disponible(s), non acceptée(s) et non terminée(s)\n${details}` : 'Aucune quête disponible non acceptée';
  }
  isQuestPage() {
    const path = window.location?.pathname ?? '';
    return path === '/quest-home' || path.startsWith('/quest-home/');
  }
  onSwitch() { this.updateVisibility(); }
  observer() { this.updateVisibility(); }
  updateVisibility() {
    if (!this.button) return;
    const visible = this.isQuestPage();
    if (this.button.hidden !== !visible) this.button.hidden = !visible;
    if (!visible) {
      if (this.tooltip && !this.tooltip.hidden) this.tooltip.hidden = true;
      if (this.tooltipTimer) {
        globalThis.clearInterval(this.tooltipTimer);
        this.tooltipTimer = null;
      }
    }
  }
  createTooltip() {
    const tip = this.tooltip = document.createElement('div');
    tip.id = 'quest-launch-button-tooltip';
    tip.setAttribute('role','tooltip');
    tip.style.cssText = 'position:fixed;top:36px;right:216px;width:288px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:15px 17px;border:1px solid #41434a;border-radius:10px;background:#232428;color:#f2f3f5;box-shadow:0 8px 24px #0006;font:13px/1.55 sans-serif;z-index:2147483647;pointer-events:none;white-space:pre-line;';
    this.details = document.createElement('div');
    this.bar = document.createElement('progress');
    this.bar.max = 100;
    this.bar.style.cssText = 'width:100%;height:7px;margin-top:10px;accent-color:#23a55a;';
    this.bar.setAttribute('aria-label','Progression confirmée par Discord');
    tip.append(this.details,this.bar);
    tip.hidden = true;
    document.body.append(tip);
    this.button.setAttribute('aria-describedby',tip.id);
    const show = () => {
      if (!this.isQuestPage()) return;
      tip.hidden=false; this.renderTooltip();
      if (!this.tooltipTimer) this.tooltipTimer=globalThis.setInterval(()=>this.renderTooltip(),1000);
    };
    const hide = () => {tip.hidden=true;globalThis.clearInterval(this.tooltipTimer);this.tooltipTimer=null;};
    this.button.addEventListener('mouseenter',show);
    this.button.addEventListener('mouseleave',hide);
    this.button.addEventListener('focus',show);
    this.button.addEventListener('blur',hide);
    this.button.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  }
  trackQuest(name, done, total) {
    this.currentQuest={name,done:Math.max(0,Number(done)||0),total:Math.max(0,Number(total)||0),updatedAt:Date.now()};
    this.renderTooltip();
  }
  trackProgress(done) {
    if(!this.currentQuest || !Number.isFinite(Number(done))) return;
    this.currentQuest.done=Math.min(this.currentQuest.total,Math.max(this.currentQuest.done,Number(done)));
    this.currentQuest.updatedAt=Date.now();
    this.renderTooltip();
  }
  renderTooltip() {
    if(!this.details) return;
    const quest=this.currentQuest;
    const active=Boolean(this.context?.active);
    const percent=quest?.total>0 ? Math.floor(quest.done/quest.total*100) : 0;
    const duration=value=>Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');
    let remaining='—';
    if(quest) {
      const seconds=Math.max(0,quest.total-quest.done);
      const elapsed=Math.max(0,(Date.now()-quest.updatedAt)/1000);
      remaining=seconds===0 ? 'Terminée' : !active ? 'Traitement arrêté' : elapsed>70 || elapsed>=seconds ? 'En attente de confirmation' : '≈ '+duration(Math.ceil(seconds-elapsed));
    }
    this.details.textContent='SUIVI DES QUÊTES\n\n'+(quest?.name ?? 'Aucune quête en cours')+'\n\nActive : '+(active?'Oui':'Non')+'\nProgression confirmée : '+(quest?percent+' % · '+duration(quest.done)+' / '+duration(quest.total):'—')+'\nTemps restant estimé : '+remaining+(this.lastError?'\n\n'+this.lastError:'')+'\n\n'+(active?'Clic : afficher / masquer la console':'Clic : lancer les quêtes');
    this.bar.value=percent;
    this.bar.hidden=!quest;
  }
  launch() {
    if (this.context?.active || globalThis[SESSION]?.active) return;
    if (globalThis[Symbol.for('QuestAutoLauncher.session')]?.active) {
      globalThis.BdApi?.UI?.showToast('Désactive QuestAutoLauncher avant de lancer ce bouton pour éviter deux scripts simultanés.', {type:'warning'});
      return;
    }
    this.lastError=null;
    this.currentQuest=null;
    const context = this.context = {active:true, timers:new Set(), cleanups:[]};
    globalThis[SESSION] = context;
    this.button.textContent = '…';
    this.button.setAttribute('aria-label','Afficher la console — quêtes en cours');
    this.button.style.color = '#23a55a';
    try { this.run(context); } catch(error) { this.fail(error); }
  }
  fail(error) {
    if (!this.context?.active) return;
    this.lastError='Erreur : '+(error?.message || 'échec du script');
    globalThis.console.error('[QuestLaunchButton]', error);
    globalThis.BdApi?.UI?.showToast('Quêtes : ' + (error?.message || 'échec du script'), {type:'error'});
    this.finish();
  }
  finish() {
    const context = this.context;
    if (context) {
      context.active = false;
      for (const timer of context.timers) globalThis.clearTimeout(timer);
      context.timers.clear();
      for (const clean of context.cleanups.reverse()) {
        try { clean(); } catch(error) { globalThis.console.error('[QuestLaunchButton]', error); }
      }
      context.cleanups.length = 0;
      if (globalThis[SESSION] === context) delete globalThis[SESSION];
    }
    if (this.button) {
      this.button.disabled = false;
      this.button.textContent = '▶';
      this.button.setAttribute('aria-label','Lancer les quêtes');
      this.button.style.color = '#dbdee1';
    }
    this.renderTooltip();
  }
  stop() {
    globalThis.clearInterval(this.questIndicatorTimer); this.questIndicatorTimer=null;
    this.questIndicator?.remove(); this.questIndicator=null;
    this.finish(); globalThis.clearInterval(this.tooltipTimer);this.tooltipTimer=null;
    this.tooltip?.remove();this.tooltip=null;this.details=null;this.bar=null;
    this.button?.remove(); this.button = null;
  }
  run(context) {
    const report = error => this.fail(error);
    const finish = () => this.finish();
    const trackQuest = (...args) => this.trackQuest(...args);
    const trackProgress = done => this.trackProgress(done);
    const console = {log:(...args) => {
      globalThis.console.log('[QuestLaunchButton]', ...args);
    }};
    const setTimeout = (fn, delay) => {
      if (!context.active) return;
      const timer = globalThis.setTimeout(() => {context.timers.delete(timer);if(context.active) fn();},delay);
      context.timers.add(timer); return timer;
    };
    const guard = object => {
      const originals = new Map(), assigned = new Map();
      context.cleanups.push(() => {for(const [key,value] of originals) if(object[key] === assigned.get(key)) object[key]=value;});
      return new Proxy(object, {
        set(target,key,value) {
          if (!context.active) return true;
          if(!originals.has(key)) originals.set(key,target[key]);
          assigned.set(key,value);target[key]=value;return true;
        },
        get(target,key) {
          const value=target[key];
          if(typeof value!=='function') return value;
          return (...args) => {
            if(!context.active) throw new Error('Script arrêté');
            if(key==='subscribe') context.cleanups.push(()=>target.unsubscribe(...args));
            const result=value.apply(target,args);
            return result?.then ? result.then(data=>{if(!context.active) throw new Error('Script arrêté');return data;}) : result;
          };
        }
      });
    };

let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
webpackChunkdiscord_app.pop();

let ApplicationStreamingStore = guard(Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata).exports.A);
let RunningGameStore = guard(Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames).exports.Ay);
let QuestsStore = guard(Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest).exports.A);
let ChannelStore = guard(Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent).exports.A);
let GuildChannelStore = guard(Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel).exports.Ay);
let FluxDispatcher = guard(Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue).exports.h);
let api = guard(Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get).exports.Bo);

const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"]
let quests = [...QuestsStore.quests.values()].filter(x => x.userStatus?.enrolledAt && !x.userStatus?.completedAt && new Date(x.config.expiresAt).getTime() > Date.now() && supportedTasks.find(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y)))
let isApp = typeof DiscordNative !== "undefined"
if(quests.length === 0) {
	console.log("Aucune quête acceptée compatible à terminer."); finish();
} else {
	let doJob = function() {
		const quest = quests.pop()
		if (!context.active) return; if(!quest) { finish(); return; }

		const pid = Math.floor(Math.random() * 30000) + 1000
		
		const questName = quest.config.messages.questName
		const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2
		const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null)
		const taskData = taskConfig.tasks[taskName]
		const applicationId = quest.config.application?.id ?? taskData.applications?.[0]?.id
		const secondsNeeded = taskData.target
		let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0; trackQuest(questName, secondsDone, secondsNeeded)

		if(taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
			const speed = 7
			const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime()
			let completed = false
			let fn = async () => {			
				while(true) {
					const remaining = Math.min(speed, secondsNeeded - secondsDone)
					await new Promise(resolve => setTimeout(resolve, remaining * 1000))

					const timestamp = secondsDone + speed
					const res = await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: Math.min(secondsNeeded, timestamp + Math.random())}})
					completed = res.body.completed_at != null
					secondsDone = Math.min(secondsNeeded, timestamp); trackProgress(secondsDone)

					if(timestamp >= secondsNeeded) {
						break
					}
				}
				if(!completed) {
					await api.post({url: `/quests/${quest.id}/video-progress`, body: {timestamp: secondsNeeded}})
				}
				trackProgress(secondsNeeded); console.log("Quest completed!")
				doJob()
			}
			fn().catch(report)
			console.log(`Spoofing video for ${questName}.`)
		} else if(taskName === "PLAY_ON_DESKTOP") {
			if(!isApp) {
				console.log("This no longer works in browser for non-video quests. Use the discord desktop app to complete the", questName, "quest!")
			} else {
				api.get({url: `/applications/public?application_ids=${applicationId}`}).then(res => {
					const appData = res.body[0]
					const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">","") ?? appData.name.replace(/[\/\\:*?"<>|]/g, "")
					
					const fakeGame = {
						cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
						exeName,
						exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
						hidden: false,
						isLauncher: false,
						id: applicationId,
						name: appData.name,
						pid: pid,
						pidPath: [pid],
						processName: appData.name,
						start: Date.now(),
					}
					const realGames = RunningGameStore.getRunningGames()
					const fakeGames = [fakeGame]
					const realGetRunningGames = RunningGameStore.getRunningGames
					const realGetGameForPID = RunningGameStore.getGameForPID
					RunningGameStore.getRunningGames = () => fakeGames
					RunningGameStore.getGameForPID = (pid) => fakeGames.find(x => x.pid === pid)
					FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames})
					
					let fn = data => {
						let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value)
						trackProgress(progress); console.log(`Quest progress: ${progress}/${secondsNeeded}`)
						
						if(progress >= secondsNeeded) {
							trackProgress(secondsNeeded); console.log("Quest completed!")
							
							RunningGameStore.getRunningGames = realGetRunningGames
							RunningGameStore.getGameForPID = realGetGameForPID
							FluxDispatcher.dispatch({type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: []})
							FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
							
							doJob()
						}
					}
					FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
					
					console.log(`Spoofed your game to ${appData.name}. Wait for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`)
				}).catch(report)
			}
		} else if(taskName === "STREAM_ON_DESKTOP") {
			if(!isApp) {
				console.log("This no longer works in browser for non-video quests. Use the discord desktop app to complete the", questName, "quest!")
			} else {
				let realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata
				ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
					id: applicationId,
					pid,
					sourceName: null
				})
				
				let fn = data => {
					let progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value)
					trackProgress(progress); console.log(`Quest progress: ${progress}/${secondsNeeded}`)
					
					if(progress >= secondsNeeded) {
						trackProgress(secondsNeeded); console.log("Quest completed!")
						
						ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc
						FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
						
						doJob()
					}
				}
				FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn)
				
				console.log(`Spoofed your stream to the target game. Stream any window in vc for ${Math.ceil((secondsNeeded - secondsDone) / 60)} more minutes.`)
				console.log("Remember that you need at least 1 other person to be in the vc!")
			}
		} else if(taskName === "PLAY_ACTIVITY") {
			const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL.length > 0).VOCAL[0].channel.id
			const streamKey = `call:${channelId}:1`
			
			let fn = async () => {
				console.log("Completing quest", questName, "-", quest.config.messages.questName)
				
				while(true) {
					const res = await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: false}})
					const progress = res.body.progress.PLAY_ACTIVITY.value
					trackProgress(progress); console.log(`Quest progress: ${progress}/${secondsNeeded}`)
					
					await new Promise(resolve => setTimeout(resolve, 20 * 1000))
					
					if(progress >= secondsNeeded) {
						await api.post({url: `/quests/${quest.id}/heartbeat`, body: {stream_key: streamKey, terminal: true}})
						break
					}
				}
				
				trackProgress(secondsNeeded); console.log("Quest completed!")
				doJob()
			}
			fn().catch(report)
		}
	}
	doJob()
}
  }
};
