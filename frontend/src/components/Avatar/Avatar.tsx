import React, { useEffect } from 'react';
import Avatars from '@dicebear/avatars';
import sprites from '@dicebear/avatars-avataaars-sprites';
import { Admin } from '../../graph/generated/schemas';
import ReactUserAvatar from 'react-user-avatar';
import {
    userAvatarWrapper,
    userAvatar,
    userAvatarText,
} from './Avatar.module.scss';
import { generateRandomColor } from '../../util/color';

export const Avatar = ({
    style,
    seed,
}: {
    style?: React.CSSProperties;
    seed: string;
}) => {
    const imageRef = React.useRef<HTMLImageElement>(null);
    useEffect(() => {
        if (imageRef.current) {
            const avatars = new Avatars(sprites, {
                style: 'circle',
                background: '#5629c6',
                eyes: ['default'],
                skin: ['tanned', 'yellow', 'pale', 'light'],
                eyebrow: ['default'],
                mouth: ['smile'],
                top: ['hat', 'longHair', 'shortHair'],
            });
            const svg = avatars.create(seed);
            imageRef.current.src = `data:image/svg+xml;utf8,${encodeURIComponent(
                svg
            )}`;
        }
    }, [seed]);
    return <img alt="" style={style} ref={imageRef} />;
};

export const AdminAvatar = ({
    adminInfo,
    size,
}: {
    adminInfo?: { name?: string; photo_url?: string; email?: string };
    size: number;
}) => {
    const identifier = adminInfo?.name
        ? adminInfo.name
              .split(' ')
              .map((e) => e[0].toUpperCase())
              .join('')
        : adminInfo?.email
        ? adminInfo.email[0].toUpperCase()
        : 'JK';
    return (
        <div className={userAvatarWrapper}>
            {adminInfo?.photo_url ? (
                <img
                    className={userAvatar}
                    style={{
                        height: size,
                        width: size,
                    }}
                    src={adminInfo.photo_url}
                />
            ) : (
                <div
                    style={{
                        backgroundColor: generateRandomColor(identifier),
                        color: 'white',
                        height: size,
                        width: size,
                    }}
                    className={userAvatarText}
                >
                    {adminInfo?.name
                        ? adminInfo.name
                              .split(' ')
                              .map((e) => e[0].toUpperCase())
                              .join('')
                        : adminInfo?.email
                        ? adminInfo.email[0].toUpperCase()
                        : 'JK'}
                </div>
            )}
        </div>
    );
};
