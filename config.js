module.exports = {
    POLL_QUESTION: 'Нужно ли вам собрание с кураторами фракции на этой неделе?',
    POLL_THUMBNAIL: 'https://media.discordapp.net/attachments/1335714856472416317/1374053742747586612/b51502e26ce0826b3a21b27a9c02dd21.png',

    ALLOWED_GUILD_IDS: [
        '905216599315853383',
        '905215719468326923',
        '905215845867868212',
        '905213593144930345',
        '905215944903761981',
        '1374137282583593120'
    ],

    INITIAL_SERVER_CONFIGS: {
        '905216599315853383': {
            name: 'Vagos',
            channelId: '905216599827578951',
            leaderRoleId: '905216599416504362',
            curatorRoleId: '905216599416504365',
            voterRoleId: '1297598938911608843',
            enabled: true
        },
        '905215719468326923': {
            name: 'Families',
            channelId: '922511347172925510',
            leaderRoleId: '922511293506814012',
            curatorRoleId: '905215719900348419',
            voterRoleId: '1227287793332519042',
            enabled: true
        },
        '905215845867868212': {
            name: 'Bloods',
            channelId: '1072925076367872040',
            leaderRoleId: '1038768482831057006',
            curatorRoleId: '1038768479043604581',
            voterRoleId: '1209991464738758747',
            enabled: true
        },
        '905215944903761981': {
            name: 'Marabunta',
            channelId: '1230538412302405653',
            leaderRoleId: '1005604927852261540',
            curatorRoleId: '905215945264488458',
            voterRoleId: '1005604273087852565',
            enabled: true
        },
        '905213593144930345': {
            name: 'Ballas',
            channelId: '1230538412302405653',
            leaderRoleId: '1005604927852261540',
            curatorRoleId: '905215945264488458',
            voterRoleId: '1005604273087852565',
            enabled: true
        },
        '1374137282583593120': {
            name: 'Support Server',
            channelId: '1374137283141439550',
            leaderRoleId: '1374137282583593123',
            curatorRoleId: '1374137282583593122',
            voterRoleId: '1374139712884834388',
            enabled: true
        }
    },

    SETTINGS_FILE_NAME: 'poll_settings.json'
};
