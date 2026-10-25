import {validateGraph} from './graph.ts';
import type {WorkNode} from './graph.ts';
const node = (id:string,parentId:string|null,kind:WorkNode['kind'],title:string,description:string,acceptance:string):WorkNode =>
  ({id,parentId,kind,title,description,acceptance,state:'ready',evidence:[]});
/** Fictional development scenario. No real investors, messages or commitments. */
export function exampleGraph() {
  return validateGraph({id:'directive-demo',workspaceId:'local-demo',revision:1,nodes:[
    node('root',null,'directive','Secure qualified investor conversations','Prepare a fictional company for investment conversations. This workspace uses simulated tasks.','Owner verifies two relevant, confirmed conversations; task completion alone does not satisfy the directive.'),
    node('readiness','root','subdirective','Make the company ready','Build an accurate source of truth before preparing investor materials.','Reviewed evidence and company brief are available.'),
    node('readiness-evidence','readiness','task','Verify the source documents','Check the supplied fictional company documents for factual gaps.','Evidence references and unresolved questions are recorded.'),
    node('readiness-brief','readiness','task','Prepare the company brief','Write a concise overview from the approved evidence.','Every material claim has an evidence reference.'),
    node('relationships','root','subdirective','Find relevant opportunities','Identify firms using their published business focus.','Research is reviewed before any contact decision.'),
    node('relationships-research','relationships','task','Research investment focus','Compare public business criteria with the fictional company profile.','Fit explanations include their sources and uncertainties.'),
    node('relationships-review','relationships','task','Review the opportunity list','Resolve missing evidence and ambiguous firm identities.','Only reviewed business-fit records remain.'),
    node('materials','root','subdirective','Prepare the conversation','Create a consistent set of factual materials.','The information package passes review.'),
    node('materials-deck','materials','task','Draft the presentation','Outline a short presentation using the company brief.','Presentation claims match reviewed source versions.'),
    node('materials-questions','materials','task','Build the diligence FAQ','Collect likely factual questions and documented answers.','Unknown answers are explicit and never invented.'),
  ],dependencies:[{id:'evidence-before-brief',source:'readiness-evidence',target:'readiness-brief'},
    {id:'research-before-review',source:'relationships-research',target:'relationships-review'},
    {id:'brief-before-deck',source:'readiness-brief',target:'materials-deck'}]});
}
