import _ from 'lodash';
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import ReactJson from 'react-json-view';
import Skeleton from 'react-loading-skeleton';
import { useParams } from 'react-router-dom';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import GoToButton from '../../../../../components/Button/GoToButton';
import { DemoContext } from '../../../../../DemoContext';
import { useGetMessagesQuery } from '../../../../../graph/generated/hooks';
import { ConsoleMessage } from '../../../../../util/shared-types';
import ReplayerContext, { ReplayerState } from '../../../ReplayerContext';
import devStyles from '../DevToolsWindow.module.scss';
import { Option } from '../Option/Option';
import styles from './ConsolePage.module.scss';

interface ParsedMessage extends ConsoleMessage {
    selected?: boolean;
    id: number;
}

export const ConsolePage = ({ time }: { time: number }) => {
    const [currentMessage, setCurrentMessage] = useState(-1);
    const [options, setOptions] = useState<Array<string>>([]);
    const { demo } = useContext(DemoContext);
    const { pause, replayer, state } = useContext(ReplayerContext);
    const [parsedMessages, setParsedMessages] = useState<
        undefined | Array<ParsedMessage>
    >([]);
    const [consoleType, setConsoleType] = useState<string>('All');
    const [isInteractingWithMessages, setIsInteractingWithMessages] = useState(
        false
    );
    const { session_id } = useParams<{ session_id: string }>();
    const { data, loading } = useGetMessagesQuery({
        variables: {
            session_id: demo
                ? process.env.REACT_APP_DEMO_SESSION ?? ''
                : session_id,
        },
        context: { headers: { 'Highlight-Demo': demo } },
        fetchPolicy: 'no-cache',
    });
    const virtuoso = useRef<VirtuosoHandle>(null);

    useEffect(() => {
        const base = parsedMessages?.map((o) => o.type) ?? [];
        const uniqueSet = new Set(base);
        setOptions(['All', ...Array.from(uniqueSet)]);
    }, [parsedMessages]);

    useEffect(() => {
        setParsedMessages(
            data?.messages?.map((m: ConsoleMessage, i) => {
                return {
                    ...m,
                    id: i,
                };
            }) ?? []
        );
    }, [data]);

    // Logic for scrolling to current entry.
    useEffect(() => {
        if (parsedMessages?.length) {
            let msgIndex = 0;
            let msgDiff: number = Math.abs(time - parsedMessages[0].time);
            for (let i = 0; i < parsedMessages.length; i++) {
                const currentDiff: number = Math.abs(
                    time - parsedMessages[i].time
                );
                if (currentDiff < msgDiff) {
                    msgIndex = i;
                    msgDiff = currentDiff;
                }
            }
            if (currentMessage !== msgIndex) {
                setCurrentMessage(msgIndex);
            }
        }
    }, [currentMessage, time, parsedMessages]);

    const currentMessages = parsedMessages?.filter((m) => {
        // if the console type is 'all', let all messages through. otherwise, filter.
        if (consoleType === 'All') {
            return true;
        } else if (m.type === consoleType) {
            return true;
        }
        return false;
    });

    const messagesToRender = useMemo(
        () =>
            currentMessages?.filter((message) => message?.value?.length) || [],
        [currentMessages]
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const scrollFunction = useCallback(
        _.debounce((index: number, state) => {
            if (virtuoso.current && state === ReplayerState.Playing) {
                virtuoso.current.scrollToIndex({
                    index,
                    align: 'center',
                    behavior: 'smooth',
                });
            }
        }, 1000 / 60),
        []
    );

    useEffect(() => {
        if (!isInteractingWithMessages) {
            scrollFunction(currentMessage, state);
        }
    }, [scrollFunction, currentMessage, isInteractingWithMessages, state]);

    return (
        <div className={styles.consolePageWrapper}>
            <div className={devStyles.topBar}>
                <div className={devStyles.optionsWrapper}>
                    {options.map((o: string, i: number) => {
                        return (
                            <Option
                                key={i}
                                onSelect={() => setConsoleType(o)}
                                selected={o === consoleType}
                                optionValue={o}
                            />
                        );
                    })}
                </div>
            </div>
            <div className={styles.consoleStreamWrapper} id="logStreamWrapper">
                {loading ? (
                    <div className={devStyles.skeletonWrapper}>
                        <Skeleton
                            count={2}
                            style={{ height: 25, marginBottom: 11 }}
                        />
                    </div>
                ) : currentMessages?.length ? (
                    <Virtuoso
                        onMouseEnter={() => {
                            setIsInteractingWithMessages(true);
                        }}
                        onMouseLeave={() => {
                            setIsInteractingWithMessages(false);
                        }}
                        ref={virtuoso}
                        overscan={500}
                        data={messagesToRender}
                        itemContent={(_index, message: ParsedMessage) => (
                            <div key={message.id.toString()}>
                                <div
                                    className={styles.consoleMessage}
                                    style={{
                                        color:
                                            message.id === currentMessage
                                                ? 'black'
                                                : 'grey',
                                        fontWeight:
                                            message.id === currentMessage
                                                ? 400
                                                : 300,
                                    }}
                                >
                                    <div
                                        className={
                                            styles.currentIndicatorWrapper
                                        }
                                        style={{
                                            visibility:
                                                message.id === currentMessage
                                                    ? 'visible'
                                                    : 'hidden',
                                        }}
                                    >
                                        <div
                                            className={styles.currentIndicator}
                                        />
                                    </div>
                                    <div className={styles.messageText}>
                                        <ConsoleRender
                                            m={message.value ?? ''}
                                        />
                                    </div>
                                    <GoToButton
                                        className={styles.goToButton}
                                        onClick={() => {
                                            pause(
                                                message.time -
                                                    (replayer?.getMetaData()
                                                        .startTime ?? 0)
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    />
                ) : (
                    <div className={devStyles.emptySection}>
                        No logs for this section.
                    </div>
                )}
            </div>
        </div>
    );
};

const ConsoleRender = ({ m }: { m: Array<any> | string }) => {
    const input: Array<any> = typeof m === 'string' ? [m] : m;
    const result: Array<string | object> = [];
    // bundle strings together.
    for (let i = 0; i < input.length; i++) {
        if (
            typeof input[i] === 'string' &&
            typeof result[result.length - 1] === 'string'
        ) {
            result[result.length - 1] += ' ' + input[i];
        } else {
            result.push(input[i]);
        }
    }
    return (
        <div>
            {result.map((r) =>
                typeof r === 'object' ? (
                    <ReactJson
                        style={{
                            fontFamily: 'Steradian',
                            fontWeight: 300,
                            margin: 10,
                        }}
                        name={false}
                        collapsed
                        src={r}
                        iconStyle="circle"
                    />
                ) : typeof r === 'string' ? (
                    <div className={styles.messageText}>{r}</div>
                ) : (
                    <div className={styles.messageText}>
                        {JSON.stringify(r)}
                    </div>
                )
            )}
        </div>
    );
};
