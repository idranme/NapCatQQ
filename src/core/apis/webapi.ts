import { RequestUtil } from '@/common/utils/request';
import {
    GroupEssenceMsgRet,
    InstanceContext,
    WebApiGroupMember,
    WebApiGroupMemberRet,
    WebApiGroupNoticeRet,
    WebHonorType,
} from '@/core';
import { NapCatCore } from '..';

export class NTQQWebApi {
    context: InstanceContext;
    core: NapCatCore;

    constructor(context: InstanceContext, core: NapCatCore) {
        this.context = context;
        this.core = core;
    }

    async shareDigest(groupCode: string, msgSeq: string, msgRandom: string, targetGroupCode: string) {
        const cookieObject = await this.core.apis.UserApi.getCookies('qun.qq.com');
        const url = `https://qun.qq.com/cgi-bin/group_digest/share_digest?${
            new URLSearchParams({
                bkn: this.getBknFromCookie(cookieObject),
                group_code: groupCode,
                msg_seq: msgSeq,
                msg_random: msgRandom,
                target_group_code: targetGroupCode,
            }).toString()
        }`;
        try {
            return RequestUtil.HttpGetText(url, 'GET', '', { 'Cookie': this.cookieToString(cookieObject) });
        } catch (e) {
            return undefined;
        }
    }

    async getGroupEssenceMsg(GroupCode: string, page_start: string) {
        const cookieObject = await this.core.apis.UserApi.getCookies('qun.qq.com');
        const url = `https://qun.qq.com/cgi-bin/group_digest/digest_list?${
            new URLSearchParams({
                bkn: this.getBknFromCookie(cookieObject),
                group_code: GroupCode,
                page_start,
                page_limit: '20',
            }).toString()
        }`;
        let ret;
        try {
            ret = await RequestUtil.HttpGetJson<GroupEssenceMsgRet>
            (url, 'GET', '', { 'Cookie': this.cookieToString(cookieObject) });
        } catch {
            return undefined;
        }
        if (ret.retcode !== 0) {
            return undefined;
        }
        return ret;
    }

    async getGroupMembers(GroupCode: string, cached: boolean = true): Promise<WebApiGroupMember[]> {
        //logDebug('webapi 获取群成员', GroupCode);
        const memberData: Array<WebApiGroupMember> = new Array<WebApiGroupMember>();
        const cookieObject = await this.core.apis.UserApi.getCookies('qun.qq.com');
        const retList: Promise<WebApiGroupMemberRet>[] = [];
        const fastRet = await RequestUtil.HttpGetJson<WebApiGroupMemberRet>
        (`https://qun.qq.com/cgi-bin/qun_mgr/search_group_members?${
            new URLSearchParams({
                st: '0',
                end: '40',
                sort: '1',
                gc: GroupCode,
                bkn: this.getBknFromCookie(cookieObject),
            }).toString()
        }`, 'POST', '', { 'Cookie': this.cookieToString(cookieObject) });
        if (!fastRet?.count || fastRet?.errcode !== 0 || !fastRet?.mems) {
            return [];
        } else {
            for (const key in fastRet.mems) {
                memberData.push(fastRet.mems[key]);
            }
        }
        //初始化获取PageNum
        const PageNum = Math.ceil(fastRet.count / 40);
        //遍历批量请求
        for (let i = 2; i <= PageNum; i++) {
            const ret = RequestUtil.HttpGetJson<WebApiGroupMemberRet>
            (`https://qun.qq.com/cgi-bin/qun_mgr/search_group_members?${
                new URLSearchParams({
                    st: ((i - 1) * 40).toString(),
                    end: (i * 40).toString(),
                    sort: '1',
                    gc: GroupCode,
                    bkn: this.getBknFromCookie(cookieObject),
                }).toString()
            }`, 'POST', '', { 'Cookie': this.cookieToString(cookieObject) });
            retList.push(ret);
        }
        //批量等待
        for (let i = 1; i <= PageNum; i++) {
            const ret = await (retList[i]);
            if (!ret?.count || ret?.errcode !== 0 || !ret?.mems) {
                continue;
            }
            for (const key in ret.mems) {
                memberData.push(ret.mems[key]);
            }
        }
        return memberData;
    }

    // public  async addGroupDigest(groupCode: string, msgSeq: string) {
    //   const url = `https://qun.qq.com/cgi-bin/group_digest/cancel_digest?random=665&X-CROSS-ORIGIN=fetch&group_code=${groupCode}&msg_seq=${msgSeq}&msg_random=444021292`;
    //   const res = await this.request(url);
    //   return await res.json();
    // }

    // public async getGroupDigest(groupCode: string) {
    //   const url = `https://qun.qq.com/cgi-bin/group_digest/digest_list?random=665&X-CROSS-ORIGIN=fetch&group_code=${groupCode}&page_start=0&page_limit=20`;
    //   const res = await this.request(url);
    //   return await res.json();
    // }

    async setGroupNotice(GroupCode: string, Content: string) {
        const cookieObject = await this.core.apis.UserApi.getCookies('qun.qq.com');
        let ret: any = undefined;
        try {
            ret = await RequestUtil.HttpGetJson<any>
            (`https://web.qun.qq.com/cgi-bin/announce/add_qun_notice${
                new URLSearchParams({
                    bkn: this.getBknFromCookie(cookieObject),
                    qid: GroupCode,
                    text: Content,
                    pinned: '0',
                    type: '1',
                    settings: '{"is_show_edit_card":1,"tip_window_type":1,"confirm_required":1}',
                }).toString()
            }`, 'GET', '', { 'Cookie': this.cookieToString(cookieObject) });
            return ret;
        } catch (e) {
            return undefined;
        }
    }

    async getGroupNotice(GroupCode: string): Promise<undefined | WebApiGroupNoticeRet> {
        const cookieObject = await this.core.apis.UserApi.getCookies('qun.qq.com');
        let ret: WebApiGroupNoticeRet | undefined = undefined;
        try {
            ret = await RequestUtil.HttpGetJson<WebApiGroupNoticeRet>(`https://web.qun.qq.com/cgi-bin/announce/get_t_list?${
                new URLSearchParams({
                    bkn: this.getBknFromCookie(cookieObject),
                    qid: GroupCode,
                    type: '1',
                    start: '0',
                    num: '1',
                }).toString()
            }`, 'GET', '', { 'Cookie': this.cookieToString(cookieObject) });
            if (ret?.ec !== 0) {
                return undefined;
            }
            return ret;
        } catch (e) {
            return undefined;
        }
    }

    async getGroupHonorInfo(groupCode: string, getType: WebHonorType) {
        const cookieObject = await this.core.apis.UserApi.getCookies('qun.qq.com');
        const getDataInternal = async (Internal_groupCode: string, Internal_type: number) => {
            const url = `https://qun.qq.com/interactive/honorlist?${
                new URLSearchParams({
                    gc: Internal_groupCode,
                    type: Internal_type.toString(),
                }).toString()
            }`;
            let resJson;
            try {
                const res = await RequestUtil.HttpGetText(url, 'GET', '', { 'Cookie': this.cookieToString(cookieObject) });
                const match = res.match(/window\.__INITIAL_STATE__=(.*?);/);
                if (match) {
                    resJson = JSON.parse(match[1].trim());
                }
                if (Internal_type === 1) {
                    return resJson?.talkativeList;
                } else {
                    return resJson?.actorList;
                }
            } catch (e) {
                this.context.logger.logDebug('获取当前群荣耀失败', url, e);
            }
            return undefined;
        };

        const HonorInfo: any = { group_id: groupCode };

        if (getType === WebHonorType.TALKATIVE || getType === WebHonorType.ALL) {
            try {
                const RetInternal = await getDataInternal(groupCode, 1);
                if (!RetInternal) {
                    throw new Error('获取龙王信息失败');
                }
                HonorInfo.current_talkative = {
                    user_id: RetInternal[0]?.uin,
                    avatar: RetInternal[0]?.avatar,
                    nickname: RetInternal[0]?.name,
                    day_count: 0,
                    description: RetInternal[0]?.desc,
                };
                HonorInfo.talkative_list = [];
                for (const talkative_ele of RetInternal) {
                    HonorInfo.talkative_list.push({
                        user_id: talkative_ele?.uin,
                        avatar: talkative_ele?.avatar,
                        description: talkative_ele?.desc,
                        day_count: 0,
                        nickname: talkative_ele?.name,
                    });
                }
            } catch (e) {
                this.context.logger.logDebug(e);
            }
        }
        if (getType === WebHonorType.PERFORMER || getType === WebHonorType.ALL) {
            try {
                const RetInternal = await getDataInternal(groupCode, 2);
                if (!RetInternal) {
                    throw new Error('获取群聊之火失败');
                }
                HonorInfo.performer_list = [];
                for (const performer_ele of RetInternal) {
                    HonorInfo.performer_list.push({
                        user_id: performer_ele?.uin,
                        nickname: performer_ele?.name,
                        avatar: performer_ele?.avatar,
                        description: performer_ele?.desc,
                    });
                }
            } catch (e) {
                this.context.logger.logDebug(e);
            }
        }
        if (getType === WebHonorType.PERFORMER || getType === WebHonorType.ALL) {
            try {
                const RetInternal = await getDataInternal(groupCode, 3);
                if (!RetInternal) {
                    throw new Error('获取群聊炽焰失败');
                }
                HonorInfo.legend_list = [];
                for (const legend_ele of RetInternal) {
                    HonorInfo.legend_list.push({
                        user_id: legend_ele?.uin,
                        nickname: legend_ele?.name,
                        avatar: legend_ele?.avatar,
                        desc: legend_ele?.description,
                    });
                }
            } catch (e) {
                this.context.logger.logDebug('获取群聊炽焰失败', e);
            }
        }
        if (getType === WebHonorType.EMOTION || getType === WebHonorType.ALL) {
            try {
                const RetInternal = await getDataInternal(groupCode, 6);
                if (!RetInternal) {
                    throw new Error('获取快乐源泉失败');
                }
                HonorInfo.emotion_list = [];
                for (const emotion_ele of RetInternal) {
                    HonorInfo.emotion_list.push({
                        user_id: emotion_ele.uin,
                        nickname: emotion_ele.name,
                        avatar: emotion_ele.avatar,
                        desc: emotion_ele.description,
                    });
                }
            } catch (e) {
                this.context.logger.logDebug('获取快乐源泉失败', e);
            }
        }
        //冒尖小春笋好像已经被tx扬了
        if (getType === WebHonorType.EMOTION || getType === WebHonorType.ALL) {
            HonorInfo.strong_newbie_list = [];
        }
        return HonorInfo;
    }

    private cookieToString(cookieObject: any) {
        return Object.entries(cookieObject).map(([key, value]) => `${key}=${value}`).join('; ');
    }

    public getBknFromCookie(cookieObject: any) {
        const sKey = cookieObject.skey as string;

        let hash = 5381;
        for (let i = 0; i < sKey.length; i++) {
            const code = sKey.charCodeAt(i);
            hash = hash + (hash << 5) + code;
        }
        return (hash & 0x7FFFFFFF).toString();
    }
}
