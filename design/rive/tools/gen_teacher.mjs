// Generates design/rive/teacher/scene.rml — the Teacher artboard, TeacherVM, TeacherSM.
// Run: node design/rive/tools/gen_teacher.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { group, ID, nid, VM, f, argb, setNs } from './lib.mjs';
import * as A from './art.mjs';
import { arm } from './arms.mjs';
import * as V from './variants.mjs';
import { visemes } from './mouth.mjs';
import { buildAnimations, buildBustAnimations } from './anim.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(fs.readFileSync(path.join(here, '../../../docs/rive/teacher.contract.json'), 'utf8'));
const vmDef = contract.viewModels.TeacherVM;

// ---- view model + enums ---------------------------------------------------------------------
const enumIds = {}, enumValueIds = {};
let enumXml = '';
for (const [ename, values] of Object.entries(contract.enums)) {
  enumIds[ename] = nid();
  enumValueIds[ename] = values.map(() => nid());
  enumXml += `<DataEnumCustom name="${ename}" id="${enumIds[ename]}">` +
    values.map((v, i) => `<DataEnumValue key="${v}" value="${v}" id="${enumValueIds[ename][i]}"/>`).join('') + `</DataEnumCustom>`;
}
const hex = (h) => argb(h);
let propXml = '', instXml = '';
for (const [name, def] of Object.entries(vmDef)) {
  const pid = nid();
  VM.props[name] = pid;
  if (def.type === 'number') { propXml += `<ViewModelPropertyNumber name="${name}" id="${pid}"/>`; instXml += `<ViewModelInstanceNumber propertyValue="${def.default}" viewModelPropertyId="${pid}"/>`; }
  else if (def.type === 'boolean') { propXml += `<ViewModelPropertyBoolean name="${name}" id="${pid}"/>`; instXml += `<ViewModelInstanceBoolean propertyValue="${def.default}" viewModelPropertyId="${pid}"/>`; }
  else if (def.type === 'color') { propXml += `<ViewModelPropertyColor name="${name}" id="${pid}"/>`; instXml += `<ViewModelInstanceColor propertyValue="${hex(def.default)}" viewModelPropertyId="${pid}"/>`; }
  else if (def.type === 'trigger') { propXml += `<ViewModelPropertyTrigger name="${name}" id="${pid}"/>`; instXml += `<ViewModelInstanceTrigger propertyValue="0" viewModelPropertyId="${pid}"/>`; }
  else if (def.type === 'enum') {
    propXml += `<ViewModelPropertyEnumCustom enumId="${enumIds[def.enum]}" name="${name}" id="${pid}"/>`;
    const idx = contract.enums[def.enum].indexOf(def.default);
    instXml += `<ViewModelInstanceEnum propertyValue="${enumValueIds[def.enum][idx]}" viewModelPropertyId="${pid}"/>`;
  }
}
for (const [en, vals] of Object.entries(contract.enums)) VM.enumVals[en] = Object.fromEntries(vals.map((v, i) => [v, enumValueIds[en][i]]));
const VMID = VM.id;
const viewModelXml = `${enumXml}<ViewModel defaultInstanceId="0:41" name="TeacherVM" id="${VMID}">${propXml}<ViewModelInstance exports="true" name="Default" id="0:41">${instXml}</ViewModelInstance></ViewModel>`;

// ---- art --------------------------------------------------------------------------------------
const mouthSolo = () => group('MouthRig', 600, 690, () => `<Solo activeComponentId="${ID('v0_rest')}" name="Mouth" id="${ID('MouthSolo')}">${visemes().join('')}</Solo>`, { id: ID('MouthRig') });

const solo = (name, firstId, inner) => `<Solo activeComponentId="${firstId}" name="${name}" id="${ID(name)}">${inner}</Solo>`;
const body = group('BodyLean', 600, 1500, () => group('Body', 600, 1500, () => {
  const head = group('HeadAim', 600, 850, () => group('Head', 600, 850, () => {
    const hairF = A.hairFront();
    return solo('EarSolo', ID('ear_studs'), V.earringVariants(A.earrings())) + A.ears() +
      A.brow('L') + A.brow('R') +
      solo('HairFrontSolo', ID('hf_bob'), V.hairFrontVariants(hairF.front + hairF.shadow)) +
      A.lashesAndBrows() +
      A.eye('L') + A.eye('R') +
      mouthSolo() +
      A.nose() + A.cheeks() +
      A.faceBase() +
      solo('HairBackSolo', ID('hb_bob'), V.hairBackVariants(A.hairBack()));
  }, { id: ID('Head') }), { id: ID('HeadAim') });
  const handProp = () => solo('HandPropSolo', ID('hp_none'), V.handProps('L'));
  return arm('R') + arm('L', handProp) + head + A.neck() + solo('NeckPropSolo', ID('np_none'), V.neckProps()) + solo('OutfitSolo', ID('of_cardigan'), V.outfitVariants(A.torso()));
}, { id: ID('Body') }), { id: ID('BodyLean') });

const anim = buildAnimations();

const artboard = `
<Artboard defaultStateMachineId="${anim.smId}" viewModelId="${VMID}" viewModelInstanceId="0:41" styleId="0:5" width="1200" height="1500" name="Teacher" id="0:2">
  <LayoutComponentStyle name="Teacher Style" id="0:5"/>
  ${body}
  ${anim.events}
  ${anim.joystick}
  ${anim.sm}
  ${anim.animations}
</Artboard>`;

// ---- TeacherBust artboard (512 x 512, head + shoulders) --------------------------------------
setNs('b_');
const bustBody = group('BustRoot', 600, 850, () => {
  const head = group('HeadAim', 600, 850, () => group('Head', 600, 850, () => {
    const hairF = A.hairFront();
    return solo('EarSolo', ID('ear_studs'), V.earringVariants(A.earrings())) + A.ears() +
      A.brow('L') + A.brow('R') +
      solo('HairFrontSolo', ID('hf_bob'), V.hairFrontVariants(hairF.front + hairF.shadow)) +
      A.lashesAndBrows() + A.eye('L') + A.eye('R') + mouthSolo() + A.nose() + A.cheeks() + A.faceBase() +
      solo('HairBackSolo', ID('hb_bob'), V.hairBackVariants(A.hairBack()));
  }, { id: ID('Head') }), { id: ID('HeadAim') });
  return head + A.neck() + solo('NeckPropSolo', ID('np_none'), V.neckProps()) + solo('OutfitSolo', ID('of_cardigan'), V.outfitVariants(A.torso()));
}, { id: ID('BustRoot'), pos: [256, 402], attrs: ' scaleX="0.54" scaleY="0.54"' });
const bustAnim = buildBustAnimations();
setNs('');
const bustArtboard = `
<Artboard defaultStateMachineId="${bustAnim.smId}" viewModelId="${VMID}" viewModelInstanceId="0:41" styleId="0:6" x="1400" width="512" height="512" name="TeacherBust" id="0:3">
  <LayoutComponentStyle name="Bust Style" id="0:6"/>
  ${bustBody}
  ${bustAnim.joystick}
  ${bustAnim.sm}
  ${bustAnim.animations}
</Artboard>`;

let rml = `<Rive version="1" kind="fragment">${artboard}${bustArtboard}${viewModelXml}${anim.roots}${bustAnim.roots}</Rive>`;

// resolve @@ placeholders (VM property paths + named ids)
rml = rml.replace(/@@([A-Za-z0-9_]+)/g, (m, key) => {
  if (VM.props[key]) return `${VMID}-${VM.props[key]}`;
  return ID(key);
});

const out = path.join(here, '../teacher/scene.rml');
fs.writeFileSync(out, rml.replace(/></g, '>\n<'));
console.log(`wrote ${out} (${(rml.length / 1024).toFixed(0)} KB)`);
