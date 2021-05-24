import React, { useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { Link, useParams } from 'react-router-dom';

import { Field } from '../../../components/Field/Field';
import {
    useGetAdminQuery,
    useGetSessionQuery,
} from '../../../graph/generated/hooks';
import { SessionPageSearchParams } from '../utils/utils';
import styles from './MetadataPanel.module.scss';

type Field = {
    type: string;
    name: string;
    value: string;
};

const MetadataPanel = () => {
    const { session_id, organization_id } = useParams<{
        session_id: string;
        organization_id: string;
    }>();

    const { loading, data } = useGetSessionQuery({
        variables: {
            id: session_id,
        },
        context: { headers: { 'Highlight-Demo': false } },
    });
    const [parsedFields, setParsedFields] = useState<Field[]>([]);

    const { data: a_data } = useGetAdminQuery({});

    useEffect(() => {
        const fields = data?.session?.fields?.filter((f) => {
            if (
                f &&
                f.type === 'user' &&
                f.name !== 'identifier' &&
                f.value.length
            ) {
                return true;
            }
            return false;
        }) as Field[];
        setParsedFields(fields);
    }, [data]);

    return (
        <div className={styles.metadataPanel}>
            {loading && !data?.session ? (
                <Skeleton
                    count={4}
                    height={35}
                    style={{
                        marginTop: 8,
                        marginBottom: 8,
                    }}
                />
            ) : (
                <>
                    <section>
                        <h2>Session</h2>
                        {data?.session?.city && (
                            <p>
                                Location: {data?.session?.city},{' '}
                                {data?.session?.state} {data?.session?.postal}
                            </p>
                        )}
                        {data?.session?.object_storage_enabled &&
                        a_data?.admin?.email.includes('highlight.run') ? (
                            <p>
                                Session Size:{' '}
                                {`${data.session.payload_size / 1000000}`}
                                mb
                            </p>
                        ) : (
                            <></>
                        )}
                    </section>
                    <section>
                        <h2>User Details</h2>
                        <p>Locale: {data?.session?.language}</p>
                        {!(!parsedFields?.length || loading) ? (
                            <div className={styles.tagDiv}>
                                <div className={styles.tagWrapper}>
                                    {parsedFields?.map((f, i) => (
                                        <Field
                                            key={i.toString()}
                                            color={'normal'}
                                            k={f.name}
                                            v={f.value}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className={styles.noMetadataContainer}>
                                <p>
                                    Did you know that you can enrich sessions
                                    with additional metadata? They'll show up
                                    here. You can{' '}
                                    <a
                                        href="https://docs.highlight.run/docs/identifying-users"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        learn more here
                                    </a>
                                    .
                                </p>
                            </div>
                        )}
                    </section>

                    <section>
                        <h2>Device Details</h2>
                        {data?.session?.fingerprint && (
                            <Link
                                to={`/${organization_id}/sessions?${new URLSearchParams(
                                    {
                                        [SessionPageSearchParams.deviceId]: data?.session.fingerprint.toString(),
                                    }
                                ).toString()}`}
                            >
                                Device#{data?.session?.fingerprint}
                            </Link>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default MetadataPanel;
