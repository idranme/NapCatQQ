import type { ModifyProfileParams, User, UserDetailInfoByUin, UserDetailInfoByUinV2 } from '@/core/entities';
import { NodeIKernelProfileListener } from '@/core/listeners';
import { RequestUtil } from '@/common/utils/request';
import { NodeIKernelProfileService, ProfileBizType, UserDetailSource } from '@/core/services';
import { InstanceContext, NapCatCore } from '..';

export class NTQQUserApi {
    context: InstanceContext;
    core: NapCatCore;

    constructor(context: InstanceContext, core: NapCatCore) {
        this.context = context;
        this.core = core;
    }

    async getProfileLike(uid: string) {
        return this.context.session.getProfileLikeService().getBuddyProfileLike({
            friendUids: [
                uid,
            ],
            basic: 1,
            vote: 1,
            favorite: 0,
            userProfile: 1,
            type: 2,
            start: 0,
            limit: 20,
        });
    }

    async setLongNick(longNick: string) {
        return this.context.session.getProfileService().setLongNick(longNick);
    }

    async setSelfOnlineStatus(status: number, extStatus: number, batteryStatus: number) {
        return this.context.session.getMsgService().setStatus({
            status: status,
            extStatus: extStatus,
            batteryStatus: batteryStatus,
        });
    }

    async getBuddyRecommendContactArkJson(uin: string, sencenID = '') {
        return this.context.session.getBuddyService().getBuddyRecommendContactArkJson(uin, sencenID);
    }

    async like(uid: string, count = 1): Promise<{ result: number, errMsg: string, succCounts: number }> {
        return this.context.session.getProfileLikeService().setBuddyProfileLike({
            friendUid: uid,
            sourceId: 71,
            doLikeCount: count,
            doLikeTollCount: 0,
        });
    }

    async setQQAvatar(filePath: string) {
        type setQQAvatarRet = { result: number, errMsg: string };
        const ret = await this.context.session.getProfileService().setHeader(filePath) as setQQAvatarRet;
        return { result: ret?.result, errMsg: ret?.errMsg };
    }

    async setGroupAvatar(gc: string, filePath: string) {
        return this.context.session.getGroupService().setHeader(gc, filePath);
    }

    async fetchUserDetailInfos(uids: string[]) {
        //26702 以上使用新接口 .Dev Mlikiowa
        type EventService = NodeIKernelProfileService['fetchUserDetailInfo'];
        type EventListener = NodeIKernelProfileListener['onUserDetailInfoChanged'];
        const retData: User[] = [];
        const [_retData, _retListener] = await this.core.eventWrapper.CallNormalEvent<
            EventService, EventListener
        >(
            'NodeIKernelProfileService/fetchUserDetailInfo',
            'NodeIKernelProfileListener/onUserDetailInfoChanged',
            uids.length,
            5000,
            (profile) => {
                if (uids.includes(profile.uid)) {
                    const RetUser: User = {
                        ...profile.simpleInfo.coreInfo,
                        ...profile.simpleInfo.status,
                        ...profile.simpleInfo.vasInfo,
                        ...profile.commonExt,
                        ...profile.simpleInfo.baseInfo,
                        qqLevel: profile.commonExt.qqLevel,
                        pendantId: '',
                    };
                    retData.push(RetUser);
                    return true;
                }
                return false;
            },
            'BuddyProfileStore',
            uids,
            UserDetailSource.KSERVER,
            [ProfileBizType.KALL],
        );

        return retData;
    }

    async fetchUserDetailInfo(uid: string) {
        type EventService = NodeIKernelProfileService['fetchUserDetailInfo'];
        type EventListener = NodeIKernelProfileListener['onUserDetailInfoChanged'];
        const [_retData, profile] = await this.core.eventWrapper.CallNormalEvent<EventService, EventListener>(
            'NodeIKernelProfileService/fetchUserDetailInfo',
            'NodeIKernelProfileListener/onUserDetailInfoChanged',
            1,
            5000,
            (profile) => profile.uid === uid,
            'BuddyProfileStore',
            [uid],
            UserDetailSource.KSERVER,
            [ProfileBizType.KALL],
        );
        const RetUser: User = {
            ...profile.simpleInfo.coreInfo,
            ...profile.simpleInfo.status,
            ...profile.simpleInfo.vasInfo,
            ...profile.commonExt,
            ...profile.simpleInfo.baseInfo,
            qqLevel: profile.commonExt.qqLevel,
            pendantId: '',
        };
        return RetUser;
    }

    async getUserDetailInfo(uid: string) {
        if (this.context.basicInfoWrapper.requireMinNTQQBuild('26702')) {
            return this.fetchUserDetailInfo(uid);
        }
        return this.getUserDetailInfoOld(uid);
    }

    async getUserDetailInfoOld(uid: string) {
        type EventService = NodeIKernelProfileService['getUserDetailInfoWithBizInfo'];
        type EventListener = NodeIKernelProfileListener['onProfileDetailInfoChanged'];
        const [_retData, profile] = await this.core.eventWrapper.CallNormalEvent<EventService, EventListener>(
            'NodeIKernelProfileService/getUserDetailInfoWithBizInfo',
            'NodeIKernelProfileListener/onProfileDetailInfoChanged',
            2,
            5000,
            (profile) => profile.uid === uid,
            uid,
            [0],
        );
        return profile;
    }

    async modifySelfProfile(param: ModifyProfileParams) {
        return this.context.session.getProfileService().modifyDesktopMiniProfile(param);
    }

    //需要异常处理
    async getCookies(domain: string) {
        const ClientKeyData = await this.forceFetchClientKey();
        const requestUrl = `https://ssl.ptlogin2.qq.com/jump?${
            new URLSearchParams({
                ptlang: '1033',
                clientuin: this.core.selfInfo.uin,
                clientkey: ClientKeyData.clientKey,
                u1: `https://user.qzone.qq.com/${this.core.selfInfo.uin}/infocenter`,
                keyindex: '19',
            })
        }`;
        return await RequestUtil.HttpsGetCookies(requestUrl);
    }

    async getPSkey(domainList: string[]) {
        return await this.context.session.getTipOffService().getPskey(domainList, true);
    }

    async getRobotUinRange(): Promise<Array<any>> {
        const robotUinRanges = await this.context.session.getRobotService().getRobotUinRange({
            justFetchMsgConfig: '1',
            type: 1,
            version: 0,
            aioKeywordVersion: 0,
        });
        // console.log(robotUinRanges?.response?.robotUinRanges);
        return robotUinRanges?.response?.robotUinRanges;
    }

    //需要异常处理

    async getQzoneCookies() {
        const ClientKeyData = await this.forceFetchClientKey();
        const requestUrl = 'https://ssl.ptlogin2.qq.com/jump?ptlang=1033&clientuin=' + this.core.selfInfo.uin + '&clientkey=' + ClientKeyData.clientKey + '&u1=https%3A%2F%2Fuser.qzone.qq.com%2F' + this.core.selfInfo.uin + '%2Finfocenter&keyindex=19%27';
        const cookies: { [key: string]: string; } = await RequestUtil.HttpsGetCookies(requestUrl);
        return cookies;
    }

    //需要异常处理

    async getSkey(): Promise<string | undefined> {
        const ClientKeyData = await this.forceFetchClientKey();
        if (ClientKeyData.result !== 0) {
            throw new Error('getClientKey Error');
        }
        const clientKey = ClientKeyData.clientKey;
        const keyIndex = ClientKeyData.keyIndex;
        const requestUrl = 'https://ssl.ptlogin2.qq.com/jump?ptlang=1033&clientuin=' + this.core.selfInfo.uin + '&clientkey=' + clientKey + '&u1=https%3A%2F%2Fh5.qzone.qq.com%2Fqqnt%2Fqzoneinpcqq%2Ffriend%3Frefresh%3D0%26clientuin%3D0%26darkMode%3D0&keyindex=19%27';
        const cookies: { [key: string]: string; } = await RequestUtil.HttpsGetCookies(requestUrl);
        const skey = cookies['skey'];
        if (!skey) {
            throw new Error('getSkey Skey is Empty');
        }
        return skey;
    }

    /**
     * @deprecated
     */
    async getUidByUin(Uin: string) {
        if (this.context.basicInfoWrapper.requireMinNTQQBuild('26702')) {
            return await this.getUidByUinV2(Uin);
        }
        return await this.getUidByUinV1(Uin);
    }

    /**
     * @deprecated
     */
    async getUinByUid(Uid: string) {
        if (this.context.basicInfoWrapper.requireMinNTQQBuild('26702')) {
            return await this.getUinByUidV2(Uid);
        }
        return await this.getUinByUidV1(Uid);
    }

    //后期改成流水线处理
    async getUidByUinV2(Uin: string) {
        let uid = (await this.context.session.getProfileService().getUidByUin('FriendsServiceImpl', [Uin])).get(Uin);
        if (uid) return uid;
        uid = (await this.context.session.getGroupService().getUidByUins([Uin])).uids.get(Uin);
        if (uid) return uid;
        uid = (await this.context.session.getUixConvertService().getUid([Uin])).uidInfo.get(Uin);
        if (uid) return uid;
       // console.log((await this.core.getApiContext().FriendApi.getBuddyIdMapCache(true)));
        uid = (await this.core.apis.FriendApi.getBuddyIdMapCache(true)).getValue(Uin);//从Buddy缓存获取Uid
        if (uid) return uid;
        uid = (await this.core.apis.FriendApi.getBuddyIdMap(true)).getValue(Uin);
        if (uid) return uid;
        const unveifyUid = (await this.getUserDetailInfoByUinV2(Uin)).detail.uid;//从QQ Native 特殊转换
        if (unveifyUid.indexOf('*') == -1) uid = unveifyUid;
        //if (uid) return uid;
        return uid;
    }

    //后期改成流水线处理
    async getUinByUidV2(Uid: string) {
        let uin = (await this.context.session.getProfileService().getUinByUid('FriendsServiceImpl', [Uid])).get(Uid);
        if (uin) return uin;
        uin = (await this.context.session.getGroupService().getUinByUids([Uid])).uins.get(Uid);
        if (uin) return uin;
        uin = (await this.context.session.getUixConvertService().getUin([Uid])).uinInfo.get(Uid);
        if (uin) return uin;
        uin = (await this.core.apis.FriendApi.getBuddyIdMapCache(true)).getKey(Uid);//从Buddy缓存获取Uin
        if (uin) return uin;
        uin = (await this.core.apis.FriendApi.getBuddyIdMap(true)).getKey(Uid);
        if (uin) return uin;
        uin = (await this.getUserDetailInfo(Uid)).uin; //从QQ Native 转换
        return uin;
    }

    async getUidByUinV1(Uin: string) {
        // 通用转换开始尝试
        let uid = (await this.context.session.getUixConvertService().getUid([Uin])).uidInfo.get(Uin);
        if (!uid) {
            const unveifyUid = (await this.getUserDetailInfoByUin(Uin)).info.uid;//从QQ Native 特殊转换 方法三
            if (unveifyUid.indexOf('*') == -1) {
                uid = unveifyUid;
            }
        }
        return uid;
    }

    async getUinByUidV1(Uid: string) {
        const ret = await this.core.eventWrapper.callNoListenerEvent<(Uin: string[]) => Promise<{
            uinInfo: Map<string, string>
        }>>
            ('NodeIKernelUixConvertService/getUin', 5000, [Uid]);
        let uin = ret.uinInfo.get(Uid);
        if (!uin) {
            uin = (await this.getUserDetailInfo(Uid)).uin; //从QQ Native 转换
        }
        // if (!uin) {
        //   uin = (await NTQQFriendApi.getFriends(false)).find((t) => { t.uid == Uid })?.uin;  //从QQ Native 缓存转换
        // }
        // if (!uin) {
        //   uin = (await NTQQFriendApi.getFriends(true)).find((t) => { t.uid == Uid })?.uin;  //从QQ Native 非缓存转换
        // }
        return uin;
    }

    async getRecentContactListSnapShot(count: number) {
        return await this.context.session.getRecentContactService().getRecentContactListSnapShot(count);
    }

    async getRecentContactListSyncLimit(count: number) {
        return await this.context.session.getRecentContactService().getRecentContactListSyncLimit(count);
    }

    async getRecentContactListSync() {
        return await this.context.session.getRecentContactService().getRecentContactListSync();
    }

    async getRecentContactList() {
        return await this.context.session.getRecentContactService().getRecentContactList();
    }

    async getUserDetailInfoByUinV2(Uin: string) {
        return await this.core.eventWrapper.callNoListenerEvent<(Uin: string) => Promise<UserDetailInfoByUinV2>>
            ('NodeIKernelProfileService/getUserDetailInfoByUin', 5000, Uin);
    }

    async getUserDetailInfoByUin(Uin: string) {
        return this.core.eventWrapper.callNoListenerEvent<(Uin: string) => Promise<UserDetailInfoByUin>>
            ('NodeIKernelProfileService/getUserDetailInfoByUin', 5000, Uin);
    }

    async forceFetchClientKey() {
        return await this.context.session.getTicketService().forceFetchClientKey('');
    }
}
