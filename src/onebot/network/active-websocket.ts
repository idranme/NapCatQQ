import { IOB11NetworkAdapter, OB11EmitEventContent } from '@/onebot/network/index';
import { WebSocket as NodeWebSocket } from 'ws';
import BaseAction from '@/onebot/action/BaseAction';
import { sleep } from '@/common/utils/helper';
import { OB11HeartbeatEvent } from '../event/meta/OB11HeartbeatEvent';
import { NapCatCore } from '@/core';
import { NapCatOneBot11Adapter } from '../main';

export class OB11ActiveWebSocketAdapter implements IOB11NetworkAdapter {
    url: string;
    reconnectIntervalInMillis: number;
    isClosed: boolean = false;
    private connection: NodeWebSocket | null = null;
    private actionMap: Map<string, BaseAction<any, any>> = new Map();
    heartbeatInterval: number;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    onebotContext: NapCatOneBot11Adapter;
    coreContext: NapCatCore;

    constructor(url: string, reconnectIntervalInMillis: number, heartbeatInterval: number, coreContext: NapCatCore, onebotContext: NapCatOneBot11Adapter) {
        this.url = url;
        this.heartbeatInterval = heartbeatInterval;
        this.reconnectIntervalInMillis = reconnectIntervalInMillis;
        this.coreContext = coreContext;
        this.onebotContext = onebotContext;
    }
    registerActionMap(actionMap: Map<string, BaseAction<any, any>>) {
        this.actionMap = actionMap;
    }
    registerHeartBeat() {
        if (this.connection) {
            this.heartbeatTimer = setInterval(() => {
                if (this.connection && this.connection.readyState === NodeWebSocket.OPEN) {
                    this.connection.send(JSON.stringify(new OB11HeartbeatEvent(this.coreContext, this.heartbeatInterval, this.coreContext.selfInfo.online, true)));
                }
            }, this.heartbeatInterval);
        }
    }

    registerAction<T extends BaseAction<P, R>, P, R>(action: T) {
        this.actionMap.set(action.actionName, action);
    }

    onEvent<T extends OB11EmitEventContent>(event: T) {
        if (this.connection) {
            this.connection.send(JSON.stringify(event));
        }
    }

    async open() {
        if (this.connection) {
            return;
        }
        await this.tryConnect();
    }

    close() {
        if (this.isClosed) {
            throw new Error('Cannot close a closed WebSocket connection');
        }
        this.isClosed = true;
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private async tryConnect() {
        while (!this.connection && !this.isClosed) {
            try {
                this.connection = new NodeWebSocket(this.url);
                this.connection.on('message', (data) => {
                    this.handleMessage(data);
                });
                this.connection.once('close', () => {
                    if (!this.isClosed) {
                        this.connection = null;
                        setTimeout(() => this.tryConnect(), this.reconnectIntervalInMillis);
                    }
                });
                this.registerHeartBeat();
            } catch (e) {
                this.connection = null;
                console.log('Failed to connect to the server, retrying in 5 seconds...');
                await sleep(5000);
            }
        }
    }

    private handleMessage(data: any) {
        try {
            const message = JSON.parse(data);
            const action = this.actionMap.get(message.actionName);
            if (action) {
                action.handle(message.payload);
            }
        } catch (e) {
            console.error('Failed to handle message:', e);
        }
    }
}