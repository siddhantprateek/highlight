import {
    DebugOptions,
    Highlight,
    HighlightClassOptions,
    IntegrationOptions,
    NetworkRecordingOptions,
    SessionShortcutOptions,
} from '../../client/src/index';
import { FeedbackWidgetOptions } from '../../client/src/ui/feedback-widget/feedback-widget';
import packageJson from '../package.json';
import { listenToChromeExtensionMessage } from './browserExtension/extensionListener';
import {
    AmplitudeAPI,
    setupAmplitudeIntegration,
} from './integrations/amplitude';
import { MixpanelAPI, setupMixpanelIntegration } from './integrations/mixpanel';
import { initializeFetchListener } from './listeners/fetch';
import { SessionDetails } from './types/types';
import HighlightSegmentMiddleware from './integrations/segment';

initializeFetchListener();

export type HighlightOptions = {
    /**
     * Do not use this.
     * @private
     */
    debug?: boolean | DebugOptions;
    /**
     * Do not use this.
     * @private
     */
    scriptUrl?: string;
    /**
     * Specifies where to send Highlight session data.
     * You should not have to set this unless you are running an on-premise instance.
     */
    backendUrl?: string;
    /**
     * Specifies where the backend of the app lives. If specified, Highlight will attach the
     * X-Highlight-Request header to outgoing requests whose destination URLs match a substring
     * or regexp from this list, so that backend errors can be linked back to the session.
     * If 'true' is specified, all requests to the current domain will be matched.
     * @example tracingOrigins: ['localhost', /^\//, 'backend.myapp.com']
     */
    tracingOrigins?: boolean | (string | RegExp)[];
    /**
     * Specifies if Highlight should not automatically start recording when the app starts.
     * This should be used with `H.start()` and `H.stop()` if you want to control when Highlight records.
     * @default false
     */
    manualStart?: boolean;
    /**
     * This disables recording network requests.
     * The data includes the URLs, the size of the request, and how long the request took.
     * @default false
     * @deprecated Use `networkRecording` instead.
     */
    disableNetworkRecording?: boolean;
    /**
     * Specifies how and what Highlight records from network requests and responses.
     */
    networkRecording?: boolean | NetworkRecordingOptions;
    /**
     * Specifies whether Highlight will record console messages.
     * @default false
     */
    disableConsoleRecording?: boolean;
    enableSegmentIntegration?: boolean;
    /**
     * Specifies the environment your application is running in.
     * This is useful to distinguish whether your session was recorded on localhost or in production.
     * @default 'production'
     */
    environment?: 'development' | 'staging' | 'production' | string;
    /**
     * Specifies the version of your application.
     * This is commonly a Git hash or a semantic version.
     */
    version?: string;
    /**
     * Specifies whether Highlight should redact data during recording.
     * Enabling this will disable recording of text data on the page. This is useful if you do not want to record personally identifiable information and don't want to manually annotate your code with the class name "highlight-block".
     * @example
     * // Text will be randomized. Instead of seeing "Hello World" in a recording, you will see "1fds1 j59a0".
     * @see {@link https://docs.highlight.run/docs/privacy} for more information.
     */
    enableStrictPrivacy?: boolean;
    /**
     * Specifies whether to record canvas elements or not.
     * @default false
     */
    enableCanvasRecording?: boolean;
    integrations?: IntegrationOptions;
    /**
     * Specifies the keyboard shortcut to open the current session in Highlight.
     * @see {@link https://docs.highlight.run/session-shortcut} for more information.
     */
    sessionShortcut?: SessionShortcutOptions;
    /**
     * Specifies whether to show the Highlight feedback widget. This allows users to submit feedback for their current session.
     */
    feedbackWidget?: FeedbackWidgetOptions;
};

interface SessionFeedbackOptions {
    verbatim: string;
    userName?: string;
    userEmail?: string;
    timestampOverride?: string;
}

const HighlightWarning = (context: string, msg: any) => {
    console.warn(`Highlight Warning: (${context}): `, msg);
};

const _startListening = (options?: HighlightOptions) => {
    if (options?.enableSegmentIntegration) {
        this.listeners.push(
            SegmentIntegrationListener((obj: any) => {
                if (obj.type === 'track') {
                    const properties: { [key: string]: string } = {};
                    properties['segment-event'] = obj.event;
                    highlightThis.addProperties(properties, {
                        type: 'track',
                        source: 'segment',
                    });
                } else if (obj.type === 'identify') {
                    // Removes the starting and end quotes
                    // Example: "boba" -> boba
                    const trimmedUserId = obj.userId.replace(/^"(.*)"$/, '$1');

                    highlightThis.identify(
                        trimmedUserId,
                        obj.traits,
                        'segment'
                    );
                }
            })
        );
    }

    if (document.referrer) {
        // Don't record the referrer if it's the same origin.
        // Non-single page apps might have the referrer set to the same origin.
        // If we record this then the referrer data will not be useful.
        // Most users will want to see referrers outside of their website/app.
        // This will be a configuration set in `H.init()` later.
        if (!(window && document.referrer.includes(window.location.origin))) {
            this.addCustomEvent<string>('Referrer', document.referrer);
            highlightThis.addProperties(
                { referrer: document.referrer },
                { type: 'session' }
            );
        }
    }
    this.listeners.push(
        PathListener((url: string) => {
            if (reloaded) {
                this.addCustomEvent<string>('Reload', url);
                reloaded = false;
                highlightThis.addProperties(
                    { reload: true },
                    { type: 'session' }
                );
            } else {
                this.addCustomEvent<string>('Navigate', url);
            }
            highlightThis.addProperties(
                { 'visited-url': url },
                { type: 'session' }
            );
        })
    );
    if (!this.disableConsoleRecording) {
        this.listeners.push(
            ConsoleListener(
                (c: ConsoleMessage) => {
                    if (
                        (c.type === 'Error' || c.type === 'error') &&
                        c.value &&
                        c.trace
                    ) {
                        const errorValue = stringify(c.value);
                        if (
                            ERRORS_TO_IGNORE.includes(errorValue) ||
                            ERROR_PATTERNS_TO_IGNORE.some((pattern) =>
                                errorValue.includes(pattern)
                            )
                        ) {
                            return;
                        }
                        highlightThis.errors.push({
                            event: errorValue,
                            type: 'console.error',
                            url: window.location.href,
                            source: c.trace[0]?.fileName
                                ? c.trace[0].fileName
                                : '',
                            lineNumber: c.trace[0]?.lineNumber
                                ? c.trace[0].lineNumber
                                : 0,
                            columnNumber: c.trace[0]?.columnNumber
                                ? c.trace[0].columnNumber
                                : 0,
                            stackTrace: c.trace,
                            timestamp: new Date().toISOString(),
                        });
                    } else {
                        highlightThis.messages.push(c);
                    }
                },
                {
                    lengthThreshold: 1000,
                    level: [
                        'assert',
                        'count',
                        'countReset',
                        'debug',
                        'dir',
                        'dirxml',
                        'error',
                        'group',
                        'groupCollapsed',
                        'groupEnd',
                        'info',
                        'log',
                        'table',
                        'time',
                        'timeEnd',
                        'timeLog',
                        'trace',
                        'warn',
                    ],
                    logger: 'console',
                    stringifyOptions: {
                        depthOfLimit: 10,
                        numOfKeysLimit: 100,
                        stringLengthLimit: 1000,
                    },
                }
            )
        );
    }
    this.listeners.push(
        ErrorListener((e: ErrorMessage) => highlightThis.errors.push(e))
    );
    this.listeners.push(
        ViewportResizeListener((viewport) => {
            this.addCustomEvent('Viewport', viewport);
        })
    );
    this.listeners.push(
        ClickListener((clickTarget) => {
            if (clickTarget) {
                this.addCustomEvent('Click', clickTarget);
            }
        })
    );
    this.listeners.push(
        FocusListener((focusTarget) => {
            if (focusTarget) {
                this.addCustomEvent('Focus', focusTarget);
            }
        })
    );

    this.listeners.push(
        WebVitalsListener((data) => {
            const { name, value } = data;
            try {
                this.graphqlSDK.addWebVitals({
                    session_id: this.sessionData.sessionID.toString(),
                    metric: { name, value },
                });
            } catch {}
        })
    );

    if (this.sessionShortcut) {
        SessionShortcutListener(this.sessionShortcut, () => {
            window.open(this.getCurrentSessionURLWithTimestamp(), '_blank');
        });
    }

    if (!this.disableNetworkRecording && this.enableRecordingNetworkContents) {
        this.listeners.push(
            NetworkListener({
                xhrCallback: (requestResponsePair) => {
                    this.xhrNetworkContents.push(requestResponsePair);
                },
                fetchCallback: (requestResponsePair) => {
                    this.fetchNetworkContents.push(requestResponsePair);
                },
                headersToRedact: this.networkHeadersToRedact,
                backendUrl: this._backendUrl,
                tracingOrigins: this.tracingOrigins,
                urlBlocklist: this.urlBlocklist,
                sessionData: this.sessionData,
            })
        );
    }

    this.listeners.push(
        PerformanceListener((payload: PerformancePayload) => {
            this.addCustomEvent('Performance', stringify(payload));
        }, this._recordingStartTime)
    );
};

export interface HighlightPublicInterface {
    init: (projectID?: string | number, debug?: HighlightOptions) => void;
    /**
     * Calling this will assign an identifier to the session.
     * @example identify('teresa@acme.com', { accountAge: 3, cohort: 8 })
     * @param identifier Is commonly set as an email or UUID.
     * @param metadata Additional details you want to associate to the user.
     */
    identify: (identifier: string, metadata?: Metadata) => void;
    /**
     * Call this to record when you want to track a specific event happening in your application.
     * @example track('startedCheckoutProcess', { cartSize: 10, value: 85 })
     * @param event The name of the event.
     * @param metadata Additional details you want to associate to the event.
     */
    track: (event: string, metadata?: Metadata) => void;
    /**
     * @deprecated with replacement by `consumeError` for an in-app stacktrace.
     */
    error: (message: string, payload?: { [key: string]: string }) => void;
    /**
     * Calling this method will report an error in Highlight and map it to the current session being recorded.
     * A common use case for `H.error` is calling it right outside of an error boundary.
     * @see {@link https://docs.highlight.run/docs/error-handling} for more information.
     */
    consumeError: (
        error: Error,
        message?: string,
        payload?: { [key: string]: string }
    ) => void;
    getSessionURL: () => Promise<string>;
    getSessionDetails: () => Promise<SessionDetails>;
    start: () => void;
    /** Stops the session and error recording. */
    stop: () => void;
    onHighlightReady: (func: () => void) => void;
    options: HighlightOptions | undefined;
    /**
     * Calling this will add a feedback comment to the session.
     */
    addSessionFeedback: (feedbackOptions: SessionFeedbackOptions) => void;
    /**
     * Calling this will toggle the visibility of the feedback modal.
     */
    toggleSessionFeedbackModal: () => void;
}

interface Metadata {
    [key: string]: string | boolean | number;
}

interface HighlightWindow extends Window {
    Highlight: new (options?: HighlightClassOptions) => Highlight;
    H: HighlightPublicInterface;
    mixpanel?: MixpanelAPI;
    amplitude?: AmplitudeAPI;
    Intercom?: any;
}

declare var window: HighlightWindow;

var script: HTMLScriptElement;
var highlight_obj: Highlight;
export const H: HighlightPublicInterface = {
    options: undefined,
    init: (projectID?: string | number, options?: HighlightOptions) => {
        try {
            H.options = options;

            // Don't run init when called outside of the browser.
            if (
                typeof window === 'undefined' ||
                typeof document === 'undefined'
            ) {
                return;
            }

            // Don't initialize if an projectID is not set.
            if (!projectID) {
                console.info(
                    'Highlight is not initializing because projectID was passed undefined.'
                );
                return;
            }

            script = document.createElement('script');
            var scriptSrc = options?.scriptUrl
                ? options.scriptUrl
                : 'https://static.highlight.run/index.js';
            script.setAttribute(
                'src',
                scriptSrc + '?' + new Date().getMilliseconds()
            );
            script.setAttribute('type', 'text/javascript');
            document.getElementsByTagName('head')[0].appendChild(script);
            script.addEventListener('load', () => {
                highlight_obj = new window.Highlight({
                    organizationID: projectID,
                    debug: options?.debug,
                    backendUrl: options?.backendUrl,
                    tracingOrigins: options?.tracingOrigins,
                    disableNetworkRecording: options?.disableNetworkRecording,
                    networkRecording: options?.networkRecording,
                    disableConsoleRecording: options?.disableConsoleRecording,
                    enableSegmentIntegration: options?.enableSegmentIntegration,
                    enableStrictPrivacy: options?.enableStrictPrivacy || false,
                    enableCanvasRecording: options?.enableCanvasRecording,
                    firstloadVersion: packageJson['version'],
                    environment: options?.environment || 'production',
                    appVersion: options?.version,
                    sessionShortcut: options?.sessionShortcut,
                    feedbackWidget: options?.feedbackWidget,
                });
                if (!options?.manualStart) {
                    highlight_obj.initialize();
                }
            });

            if (options?.integrations?.mixpanel?.projectToken) {
                setupMixpanelIntegration(options.integrations.mixpanel);
            }

            if (options?.integrations?.amplitude?.apiKey) {
                setupAmplitudeIntegration(options.integrations.amplitude);
            }
        } catch (e) {
            HighlightWarning('init', e);
        }
    },
    addSessionFeedback: ({
        verbatim,
        userName,
        userEmail,
        timestampOverride,
    }) => {
        try {
            H.onHighlightReady(() =>
                highlight_obj.addSessionFeedback({
                    verbatim,
                    timestamp: timestampOverride || new Date().toISOString(),
                    user_email: userEmail,
                    user_name: userName,
                })
            );
        } catch (e) {
            HighlightWarning('error', e);
        }
    },
    toggleSessionFeedbackModal: () => {
        try {
            H.onHighlightReady(() =>
                highlight_obj.toggleFeedbackWidgetVisibility()
            );
        } catch (e) {
            HighlightWarning('error', e);
        }
    },
    consumeError: (
        error: Error,
        message?: string,
        payload?: { [key: string]: string }
    ) => {
        try {
            H.onHighlightReady(() =>
                highlight_obj.consumeCustomError(
                    error,
                    message,
                    JSON.stringify(payload)
                )
            );
        } catch (e) {
            HighlightWarning('error', e);
        }
    },
    error: (message: string, payload?: { [key: string]: string }) => {
        try {
            H.onHighlightReady(() =>
                highlight_obj.pushCustomError(message, JSON.stringify(payload))
            );
        } catch (e) {
            HighlightWarning('error', e);
        }
    },
    track: (event: string, metadata: Metadata = {}) => {
        try {
            H.onHighlightReady(() =>
                highlight_obj.addProperties({ ...metadata, event: event })
            );
            const highlightUrl = highlight_obj?.getCurrentSessionURL();

            if (window.mixpanel?.track) {
                window.mixpanel.track(event, {
                    ...metadata,
                    highlightSessionURL: highlightUrl,
                });
            }

            if (window.amplitude?.getInstance) {
                window.amplitude.getInstance().logEvent(event, {
                    ...metadata,
                    highlightSessionURL: highlightUrl,
                });
            }
            if (window.Intercom) {
                window.Intercom('trackEvent', event, metadata);
            }
        } catch (e) {
            HighlightWarning('track', e);
        }
    },
    start: () => {
        try {
            if (highlight_obj?.state === 'Recording') {
                console.warn(
                    'You cannot called `start()` again. The session is already being recorded.'
                );
                return;
            }
            if (H.options?.manualStart) {
                var interval = setInterval(function () {
                    if (highlight_obj) {
                        clearInterval(interval);
                        highlight_obj.initialize();
                    }
                }, 200);
            } else {
                console.warn(
                    "Highlight Error: Can't call `start()` without setting `manualStart` option in `H.init`"
                );
            }
        } catch (e) {
            HighlightWarning('start', e);
        }
    },
    stop: () => {
        try {
            H.onHighlightReady(() => highlight_obj.stopRecording(true));
        } catch (e) {
            HighlightWarning('stop', e);
        }
    },
    identify: (identifier: string, metadata: Metadata = {}) => {
        try {
            H.onHighlightReady(() =>
                highlight_obj.identify(identifier, metadata)
            );
        } catch (e) {
            HighlightWarning('identify', e);
        }
        if (window.mixpanel?.identify) {
            window.mixpanel.identify(identifier);
        }
        if (window.amplitude?.getInstance) {
            window.amplitude.getInstance().setUserId(identifier);

            if (Object.keys(metadata).length > 0) {
                const amplitudeUserProperties = Object.keys(metadata).reduce(
                    (acc, key) => {
                        acc.set(key, metadata[key]);

                        return acc;
                    },
                    new window.amplitude.Identify()
                );

                window.amplitude
                    .getInstance()
                    .identify(amplitudeUserProperties);
            }
        }
    },
    getSessionURL: () => {
        return new Promise<string>((resolve, reject) => {
            H.onHighlightReady(() => {
                const res = highlight_obj.getCurrentSessionURL();
                if (res) {
                    resolve(res);
                } else {
                    reject(new Error('Unable to get session URL'));
                }
            });
        });
    },
    getSessionDetails: () => {
        return new Promise<SessionDetails>((resolve, reject) => {
            H.onHighlightReady(() => {
                const baseUrl = highlight_obj.getCurrentSessionURL();
                if (baseUrl) {
                    const currentSessionTimestamp = highlight_obj.getCurrentSessionTimestamp();
                    const now = new Date().getTime();
                    const url = new URL(baseUrl);
                    const urlWithTimestamp = new URL(baseUrl);
                    urlWithTimestamp.searchParams.set(
                        'ts',
                        // The delta between when the session recording started and now.
                        ((now - currentSessionTimestamp) / 1000).toString()
                    );

                    resolve({
                        url: url.toString(),
                        urlWithTimestamp: urlWithTimestamp.toString(),
                    });
                } else {
                    reject(new Error('Could not get session URL'));
                }
            });
        });
    },
    onHighlightReady: (func: () => void) => {
        try {
            if (highlight_obj && highlight_obj.ready) {
                func();
            } else {
                var interval = setInterval(function () {
                    if (highlight_obj && highlight_obj.ready) {
                        clearInterval(interval);
                        func();
                    }
                }, 200);
            }
        } catch (e) {
            HighlightWarning('onHighlightReady', e);
        }
    },
};

if (typeof window !== 'undefined') {
    window.H = H;
}

listenToChromeExtensionMessage();

export { HighlightSegmentMiddleware };
