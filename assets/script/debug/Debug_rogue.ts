import {
    _decorator,
    Button,
    Component,
    EditBox,
    instantiate,
    Label,
    Node,
    random,
    Slider,
    Toggle,
} from "cc";
import { ZComponent } from "../kit/ui_base/ZComponent";
import { IButtonClick } from "../kit/ui_base/IButtonClick";
const { ccclass, property } = _decorator;

@ccclass("Debug_rogue")
export class Debug_rogue extends ZComponent implements IButtonClick {
    @property(Node) $nd_cand0!: Node;
    @property(Node) $nd_cand1!: Node;
    @property(Node) $nd_cand2!: Node;
    @property(Node) $nd_cand3!: Node;
    @property(Node) $nd_bagA!: Node;
    @property(Node) $nd_bagB!: Node;
    @property(Node) $nd_bagC!: Node;
    @property(Node) $nd_poolContent!: Node;
    @property(Node) $nd_prefabRecord!: Node;
    @property(Label) $label_chooseNum!: Label;
    @property(Label) $label_path!: Label;
    @property(Toggle) $toggle_pathEvoBreak!: Toggle;
    @property(EditBox) $EditBox_maxBagRateModifier!: EditBox;
    @property(EditBox) $EditBox_maxSkillNum!: EditBox;

    private _skillPool: Skill[] = [];
    private _skillBag: SkillBag = new SkillBag();
    private _skillCandidateScoreDict: { [key: string]: number } = {};
    private _bagRateModifier = -1;
    public get bagRateModifier() {
        return this._bagRateModifier;
    }
    public set bagRateModifier(value) {
        if (value != this._bagRateModifier) {
            this._bagRateModifier = value;
        }
    }
    private _chooseNum = 0;
    public get chooseNum() {
        return this._chooseNum;
    }
    public set chooseNum(value) {
        this._chooseNum = value;
        this.$label_chooseNum.string = `总选择次数：${value}`;
    }
    private _pathRecord: string[] = [];
    start() {
        this.bagRateModifier = 0;
        this.reset();
    }

    private genDefaultSkills() {
        const skills: Skill[] = [];
        const len = +this.$EditBox_maxSkillNum.string;
        // 7槽;
        for (let i = 1; i <= len; i++) {
            // active
            skills.push({
                skillName: `a${i}`,
                level: 0,
                maxLevel: 6,
                type: "a",
                evoWith: `b${i}`,
                evoInto: `c${i}`,
                evoFrom: [],
            });
            // passive
            skills.push({
                skillName: `b${i}`,
                level: 0,
                maxLevel: 6,
                type: "b",
                evoWith: `a${i}`,
                evoInto: `c${i}`,
                evoFrom: [],
            });
            // evolution
            skills.push({
                skillName: `c${i}`,
                level: 0,
                maxLevel: 1,
                evoInto: "",
                evoWith: "",
                type: "c",
                evoFrom: [`a${i}`, `b${i}`],
            });
        }
        return skills;
    }
    private reset() {
        this.chooseNum = 0;
        this._skillPool = this.genDefaultSkills();
        this._skillBag = new SkillBag();
        this.$label_path.string = "";
        this._pathRecord = [""];

        this.change();
    }

    private change() {
        //reroll
        this.recalcCandidates();
        // refresh
        this.refreshCandidateView();
        this.refreshPoolView();
        this.refreshBagView();
    }

    private recalcCandidates(n = 3) {
        // 从技能池中随机选取n个技能; 元素的引用相同
        // 给pool中元素打个分;
        this._skillPool.forEach(skill => {
            // 背包中已经满级的技能必然不会出; 0
            if (skill.maxLevel <= skill.level) {
                this._skillCandidateScoreDict[skill.skillName] = 0;
                return;
            }

            // 背包中可进化但未进化的技能必然会出; 10
            if (skill.type == "c" && !this._skillBag.hasSkill(skill.skillName)) {
                let canEvo = true;
                skill.evoFrom.forEach(evoFromSkillName => {
                    if (this._skillBag.hasSkill(evoFromSkillName)) {
                        const evoFromSkill = this._skillBag.getSkill(evoFromSkillName)!;
                        if (
                            evoFromSkill.type == "a" &&
                            evoFromSkill.level < evoFromSkill.maxLevel
                        ) {
                            canEvo = false;
                        }
                    } else {
                        canEvo = false;
                    }
                });
                this._skillCandidateScoreDict[skill.skillName] = canEvo ? 10 : 0;
                return;
            }
            let range = 1.0;
            const isInBag = this._skillBag.hasSkill(skill.skillName);
            // 如果背包满了, 则只能出现背包内相关技能
            if (this._skillBag.isTypeAFull && skill.type == "a" && !isInBag) {
                this._skillCandidateScoreDict[skill.skillName] = 0;
                return;
            }
            if (this._skillBag.isTypeBFull && skill.type == "b" && !isInBag) {
                this._skillCandidateScoreDict[skill.skillName] = 0;
                return;
            }
            // 与背包中有组合的技能, 概率提高
            if (this._skillBag.isSkillRelated(skill)) {
                range += this.bagRateModifier;
            }

            // // 背包中拥有的技能概率高一些; 等级越高概率越高; 每级的概率范围加成为k; //TODO 这条不可取
            // const k = 0.2;
            // this._skillCandidateScoreDict[skill.skillName] = Math.random() * (1 + skill.level * k);

            this._skillCandidateScoreDict[skill.skillName] = Math.random() * range;
        });

        // sort pool
        this._skillPool.sort((a, b) => {
            return (
                this._skillCandidateScoreDict[b.skillName] -
                this._skillCandidateScoreDict[a.skillName]
            );
        });
        // TODO 主被动技能搭配要合理; 做一些微调

        // cand node active
        this.$nd_cand0.active =
            n > 0 && this._skillCandidateScoreDict[this._skillPool[0].skillName] > 0;
        this.$nd_cand1.active =
            n > 1 && this._skillCandidateScoreDict[this._skillPool[1].skillName] > 0;
        this.$nd_cand2.active =
            n > 2 && this._skillCandidateScoreDict[this._skillPool[2].skillName] > 0;
        this.$nd_cand3.active =
            n > 3 && this._skillCandidateScoreDict[this._skillPool[3].skillName] > 0;
    }

    private choose(index: number) {
        this.chooseNum++;
        // choose
        const skill = this._skillPool[index];
        // add to bag
        this._skillBag.addSkill(skill);
        // add to path
        this._pathRecord.push(
            `${this.chooseNum}-${skill.skillName}-${skill.level}/${skill.maxLevel}`
        );
        if (this.chooseNum % 2 == 0) {
            this._pathRecord.push("\n");
        }
        this.$label_path.string = this._pathRecord.join("__");
        // change
        this.change();
    }

    private refreshPoolView() {
        this.$nd_poolContent.destroyAllChildren();
        this.$nd_poolContent.removeAllChildren();
        // 已经根据根据score排序了
        this._skillPool.forEach(skill => {
            const record = instantiate(this.$nd_prefabRecord);
            record.active = true;
            const score = this._skillCandidateScoreDict[skill.skillName].toFixed(2);
            // 此处应该把积分显示出来
            record.getComponent(
                Label
            )!.string = `${skill.skillName}_${skill.level}/${skill.maxLevel}_${score}`;
            record.setParent(this.$nd_poolContent);
        });
    }
    private refreshBagView() {
        this.$nd_bagA.destroyAllChildren();
        this.$nd_bagB.destroyAllChildren();
        this.$nd_bagC.destroyAllChildren();
        this.$nd_bagA.removeAllChildren();
        this.$nd_bagB.removeAllChildren();
        this.$nd_bagC.removeAllChildren();

        this._skillBag.listA.forEach(skill => {
            const record = instantiate(this.$nd_prefabRecord);
            record.active = true;
            record.getComponent(
                Label
            )!.string = `${skill.skillName}_${skill.level}/${skill.maxLevel}`;
            record.setParent(this.$nd_bagA);
        });
        this._skillBag.listB.forEach(skill => {
            const record = instantiate(this.$nd_prefabRecord);
            record.active = true;
            record.getComponent(
                Label
            )!.string = `${skill.skillName}_${skill.level}/${skill.maxLevel}`;
            record.setParent(this.$nd_bagB);
        });
        this._skillBag.listC.forEach(skill => {
            const record = instantiate(this.$nd_prefabRecord);
            record.active = true;
            record.getComponent(
                Label
            )!.string = `${skill.skillName}_${skill.level}/${skill.maxLevel}`;
            record.setParent(this.$nd_bagC);
        });
    }

    private refreshCandidateView() {
        this.setCandCell(this.$nd_cand0, this._skillPool[0]);
        this.setCandCell(this.$nd_cand1, this._skillPool[1]);
        this.setCandCell(this.$nd_cand2, this._skillPool[2]);
        this.setCandCell(this.$nd_cand3, this._skillPool[3]);
    }
    private setCandCell(nd: Node, skill: Skill) {
        nd.getChildByName("$label_name")!.getComponent(Label)!.string = skill.skillName;
        nd.getChildByName("$label_level")!.getComponent(Label)!.string = `Lv.${skill.level}`;
    }

    private randomChoosePath() {
        if (this._skillCandidateScoreDict[this._skillPool[0].skillName] > 0) {
            const isEvo = this._skillPool[0].type == "c";
            this.choose(0);
            if (this.$toggle_pathEvoBreak.isChecked && isEvo) {
                return;
            }
            this.scheduleOnce(() => {
                this.randomChoosePath();
            });
        }
    }

    onEditBoxReturnEvent(ed: EditBox, arg: string) {
        switch (arg) {
            case "skill_num":
                this.reset();
                break;
            case "bag_rate_mod":
                this.bagRateModifier = +this.$EditBox_maxBagRateModifier.string;
                this.reset();
                break;
        }
    }

    onButtonClickEvent(btn: Button, arg: string): void {
        switch (arg) {
            case "cand0":
                this.choose(0);
                break;
            case "cand1":
                this.choose(1);
                break;
            case "cand2":
                this.choose(2);
                break;
            case "cand3":
                this.choose(3);
                break;
            case "reset":
                this.reset();
                break;
            case "change":
                this.change();
                break;
            case "random":
                this.randomChoosePath();
                break;
        }
    }
}

/**
 * 构思一个卡牌升级rogue;
 * * 10个主动技能,a1到a10
 * * 10个被动技能,b1到b10
 * * 10个进化技能,c1到c10
 * * 主动和被动技能都有级别, 最高6级;
 * * 进化技能只有1级;
 * * a1升满级(6级)后, 有b1存在(1级及以上)时, 可以进化到c1; 其余技能类推
 *
 * 需要确认技能的结构
 * 需要确认选择池的结构
 * 需要确认技能背包的结构
 *
 * 每次选择
 * * 可以从 candNum=3 个候选技能中选择一个升级
 * * 每次候选技能都是随机的
 * * 与已拥有技能形成匹配关系的技能, 会优先出现在候选中
 * * 如果所选技能未拥有, 则变为拥有, 等级=1
 * * 如果所选技能已拥有, 未满级, 则等级+1
 * * 已满级的技能不会出现在候选中
 */
const law = "";

type Skill = {
    skillName: string;
    level: number;
    maxLevel: number;
    type: "a" | "b" | "c";
    evoWith: string;
    evoInto: string;
    evoFrom: string[];
};

class SkillBag {
    listA: Skill[] = [];
    listB: Skill[] = [];
    listC: Skill[] = [];
    dict: { [key: string]: Skill } = {};

    sizeA = 7;
    sizeB = 7;

    get isTypeAFull() {
        return this.listA.length >= this.sizeA;
    }
    get isTypeBFull() {
        return this.listB.length >= this.sizeB;
    }

    getSkill(skillName: string) {
        return this.dict[skillName];
    }
    hasSkill(skillName: string) {
        return !!this.dict[skillName];
    }

    isSkillRelated(skill: Skill) {
        // in bag or evo with
        return this.hasSkill(skill.skillName) || this.hasSkill(skill.evoWith);
    }

    removeSkill(skill: Skill) {
        let list: Skill[];
        switch (skill.type) {
            case "a":
                list = this.listA;
                break;
            case "b":
                list = this.listB;
                break;
            case "c":
                list = this.listC;
                break;
            default:
                list = [];
                break;
        }

        const idx = list.indexOf(skill);
        if (idx >= 0) {
            list.splice(idx, 1);
        }
        delete this.dict[skill.skillName];
    }

    addSkill(skill: Skill) {
        if (this.hasSkill(skill.skillName)) {
            const bagSkill = this.getSkill(skill.skillName)!;
            bagSkill.level = Math.min(bagSkill.maxLevel, bagSkill.level + 1);
        } else {
            // not exist, add and rest
            switch (skill.type) {
                case "a":
                    this.listA.push(skill);
                    break;
                case "b":
                    this.listB.push(skill);
                    break;
                case "c":
                    // skill evo from, need not delete
                    this.listC.push(skill);
                    break;
            }
            this.dict[skill.skillName] = skill;
            skill.level = 1;
        }
    }
}
