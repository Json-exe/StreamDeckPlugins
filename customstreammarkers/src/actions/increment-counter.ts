import streamDeck, {
    action,
    KeyDownEvent,
    KeyUpEvent,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent
} from "@elgato/streamdeck";
import {clearInterval} from "node:timers";
import {existsSync} from "node:fs";
import {appendFile} from "node:fs/promises";

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({UUID: "com.json-exe.customstreammarkers.selfmarker"})
export class IncrementCounter extends SingletonAction<CounterSettings> {
    private declare keyDownStartTime: number | undefined;
    private static readonly longPressThreshold = 1000;
    private declare intervalId: NodeJS.Timeout | undefined;

    /**
     * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
     * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
     * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
     */
    override onWillAppear(ev: WillAppearEvent<CounterSettings>): void | Promise<void> {
        if (ev.payload.settings.startTimeStamp) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => {
                return ev.action.setTitle(`${this.getElapsedTime(ev.payload.settings.startTimeStamp)}`);
            }, 1000);
        }
        return ev.action.setTitle(`${this.getElapsedTime(ev.payload.settings.startTimeStamp)}`);
    }

    override onWillDisappear(ev: WillDisappearEvent<CounterSettings>): Promise<void> | void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        return Promise.resolve();
    }

    /**
     * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
     * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
     * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
     * settings using `setSettings` and `getSettings`.
     */
    override async onKeyDown(ev: KeyDownEvent<CounterSettings>): Promise<void> {
        this.keyDownStartTime = Date.now();
    }

    override async onKeyUp(ev: KeyUpEvent<CounterSettings>): Promise<void> {
        const elapsedTime = Date.now() - (this.keyDownStartTime || 0);
        streamDeck.logger.info(`Key up: ${elapsedTime}`);
        this.keyDownStartTime = undefined;
        const {settings} = ev.payload;

        if (elapsedTime > IncrementCounter.longPressThreshold) {
            streamDeck.logger.info("Stopping timer!");
            settings.startTimeStamp = undefined;
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        } else {
            if (!settings.startTimeStamp) {
                streamDeck.logger.info("Starting timer");
                settings.startTimeStamp = Date.now();
                if (settings.datafile && existsSync(settings.datafile)) {
                    await appendFile(settings.datafile, "", {flag: "w"});
                }

                clearInterval(this.intervalId);
                this.intervalId = setInterval(() => {
                    return ev.action.setTitle(`${this.getElapsedTime(settings.startTimeStamp)}`);
                }, 1000);
            } else {
                if (settings.datafile) {
                    streamDeck.logger.info("Appending to file");
                    if (existsSync(settings.datafile)) {
                        await appendFile(settings.datafile, `${this.getElapsedTime(settings.startTimeStamp)} - ${settings.information}\n`, "utf-8");
                    }
                } else {
                    streamDeck.logger.warn("No data file specified");
                }
            }
        }

        // Update the current count in the action's settings, and change the title.
        await ev.action.setSettings(settings);
        const time = this.getElapsedTime(settings.startTimeStamp);
        await ev.action.setTitle(`${time}`);
    }

    private getElapsedTime(startTime: number | undefined): string {
        if (!startTime) {
            return "00:00:00";
        }
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000) % 60;
        const minutes = Math.floor(elapsed / (1000 * 60)) % 60;
        const hours = Math.floor(elapsed / (1000 * 60 * 60)) % 24;

        const pad = (num: number) => num.toString().padStart(2, "0");

        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
}

/**
 * Settings for {@link IncrementCounter}.
 */
type CounterSettings = {
    startTimeStamp?: number;
    information?: string;
    datafile?: string;
};
