(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=globalThis,t=e.ShadowRoot&&(e.ShadyCSS===void 0||e.ShadyCSS.nativeShadow)&&`adoptedStyleSheets`in Document.prototype&&`replace`in CSSStyleSheet.prototype,n=Symbol(),r=new WeakMap,i=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==n)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,n=this.t;if(t&&e===void 0){let t=n!==void 0&&n.length===1;t&&(e=r.get(n)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&r.set(n,e))}return e}toString(){return this.cssText}},a=e=>new i(typeof e==`string`?e:e+``,void 0,n),o=(e,...t)=>new i(e.length===1?e[0]:t.reduce((t,n,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if(typeof e==`number`)return e;throw Error(`Value passed to 'css' function must be a 'css' function result: `+e+`. Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.`)})(n)+e[r+1],e[0]),e,n),s=(n,r)=>{if(t)n.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let t of r){let r=document.createElement(`style`),i=e.litNonce;i!==void 0&&r.setAttribute(`nonce`,i),r.textContent=t.cssText,n.appendChild(r)}},c=t?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t=``;for(let n of e.cssRules)t+=n.cssText;return a(t)})(e):e,{is:l,defineProperty:u,getOwnPropertyDescriptor:d,getOwnPropertyNames:f,getOwnPropertySymbols:p,getPrototypeOf:m}=Object,h=globalThis,g=h.trustedTypes,_=g?g.emptyScript:``,ee=h.reactiveElementPolyfillSupport,v=(e,t)=>e,y={toAttribute(e,t){switch(t){case Boolean:e=e?_:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let n=e;switch(t){case Boolean:n=e!==null;break;case Number:n=e===null?null:Number(e);break;case Object:case Array:try{n=JSON.parse(e)}catch{n=null}}return n}},te=(e,t)=>!l(e,t),ne={attribute:!0,type:String,converter:y,reflect:!1,useDefault:!1,hasChanged:te};Symbol.metadata??=Symbol(`metadata`),h.litPropertyMetadata??=new WeakMap;var b=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=ne){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let n=Symbol(),r=this.getPropertyDescriptor(e,n,t);r!==void 0&&u(this.prototype,e,r)}}static getPropertyDescriptor(e,t,n){let{get:r,set:i}=d(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){let a=r?.call(this);i?.call(this,t),this.requestUpdate(e,a,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??ne}static _$Ei(){if(this.hasOwnProperty(v(`elementProperties`)))return;let e=m(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(v(`finalized`)))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(v(`properties`))){let e=this.properties,t=[...f(e),...p(e)];for(let n of t)this.createProperty(n,e[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[e,n]of t)this.elementProperties.set(e,n)}this._$Eh=new Map;for(let[e,t]of this.elementProperties){let n=this._$Eu(e,t);n!==void 0&&this._$Eh.set(n,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let n=new Set(e.flat(1/0).reverse());for(let e of n)t.unshift(c(e))}else e!==void 0&&t.push(c(e));return t}static _$Eu(e,t){let n=t.attribute;return!1===n?void 0:typeof n==`string`?n:typeof e==`string`?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let n of t.keys())this.hasOwnProperty(n)&&(e.set(n,this[n]),delete this[n]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return s(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,n){this._$AK(e,n)}_$ET(e,t){let n=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,n);if(r!==void 0&&!0===n.reflect){let i=(n.converter?.toAttribute===void 0?y:n.converter).toAttribute(t,n.type);this._$Em=e,i==null?this.removeAttribute(r):this.setAttribute(r,i),this._$Em=null}}_$AK(e,t){let n=this.constructor,r=n._$Eh.get(e);if(r!==void 0&&this._$Em!==r){let e=n.getPropertyOptions(r),i=typeof e.converter==`function`?{fromAttribute:e.converter}:e.converter?.fromAttribute===void 0?y:e.converter;this._$Em=r;let a=i.fromAttribute(t,e.type);this[r]=a??this._$Ej?.get(r)??a,this._$Em=null}}requestUpdate(e,t,n,r=!1,i){if(e!==void 0){let a=this.constructor;if(!1===r&&(i=this[e]),n??=a.getPropertyOptions(e),!((n.hasChanged??te)(i,t)||n.useDefault&&n.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,n))))return;this.C(e,t,n)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:n,reflect:r,wrapped:i},a){n&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),!0!==i||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||n||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}let e=this.constructor.elementProperties;if(e.size>0)for(let[t,n]of e){let{wrapped:e}=n,r=this[t];!0!==e||this._$AL.has(t)||r===void 0||this.C(t,void 0,n,r)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};b.elementStyles=[],b.shadowRootOptions={mode:`open`},b[v(`elementProperties`)]=new Map,b[v(`finalized`)]=new Map,ee?.({ReactiveElement:b}),(h.reactiveElementVersions??=[]).push(`2.1.2`);var re=globalThis,ie=e=>e,ae=re.trustedTypes,oe=ae?ae.createPolicy(`lit-html`,{createHTML:e=>e}):void 0,se=`$lit$`,x=`lit$${Math.random().toFixed(9).slice(2)}$`,ce=`?`+x,le=`<${ce}>`,S=document,C=()=>S.createComment(``),w=e=>e===null||typeof e!=`object`&&typeof e!=`function`,ue=Array.isArray,de=e=>ue(e)||typeof e?.[Symbol.iterator]==`function`,fe=`[ 	
\f\r]`,T=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,pe=/-->/g,me=/>/g,E=RegExp(`>|${fe}(?:([^\\s"'>=/]+)(${fe}*=${fe}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,`g`),he=/'/g,ge=/"/g,_e=/^(?:script|style|textarea|title)$/i,D=(e=>(t,...n)=>({_$litType$:e,strings:t,values:n}))(1),O=Symbol.for(`lit-noChange`),k=Symbol.for(`lit-nothing`),ve=new WeakMap,A=S.createTreeWalker(S,129);function ye(e,t){if(!ue(e)||!e.hasOwnProperty(`raw`))throw Error(`invalid template strings array`);return oe===void 0?t:oe.createHTML(t)}var be=(e,t)=>{let n=e.length-1,r=[],i,a=t===2?`<svg>`:t===3?`<math>`:``,o=T;for(let t=0;t<n;t++){let n=e[t],s,c,l=-1,u=0;for(;u<n.length&&(o.lastIndex=u,c=o.exec(n),c!==null);)u=o.lastIndex,o===T?c[1]===`!--`?o=pe:c[1]===void 0?c[2]===void 0?c[3]!==void 0&&(o=E):(_e.test(c[2])&&(i=RegExp(`</`+c[2],`g`)),o=E):o=me:o===E?c[0]===`>`?(o=i??T,l=-1):c[1]===void 0?l=-2:(l=o.lastIndex-c[2].length,s=c[1],o=c[3]===void 0?E:c[3]===`"`?ge:he):o===ge||o===he?o=E:o===pe||o===me?o=T:(o=E,i=void 0);let d=o===E&&e[t+1].startsWith(`/>`)?` `:``;a+=o===T?n+le:l>=0?(r.push(s),n.slice(0,l)+se+n.slice(l)+x+d):n+x+(l===-2?t:d)}return[ye(e,a+(e[n]||`<?>`)+(t===2?`</svg>`:t===3?`</math>`:``)),r]},xe=class e{constructor({strings:t,_$litType$:n},r){let i;this.parts=[];let a=0,o=0,s=t.length-1,c=this.parts,[l,u]=be(t,n);if(this.el=e.createElement(l,r),A.currentNode=this.el.content,n===2||n===3){let e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;(i=A.nextNode())!==null&&c.length<s;){if(i.nodeType===1){if(i.hasAttributes())for(let e of i.getAttributeNames())if(e.endsWith(se)){let t=u[o++],n=i.getAttribute(e).split(x),r=/([.?@])?(.*)/.exec(t);c.push({type:1,index:a,name:r[2],strings:n,ctor:r[1]===`.`?we:r[1]===`?`?Te:r[1]===`@`?Ee:M}),i.removeAttribute(e)}else e.startsWith(x)&&(c.push({type:6,index:a}),i.removeAttribute(e));if(_e.test(i.tagName)){let e=i.textContent.split(x),t=e.length-1;if(t>0){i.textContent=ae?ae.emptyScript:``;for(let n=0;n<t;n++)i.append(e[n],C()),A.nextNode(),c.push({type:2,index:++a});i.append(e[t],C())}}}else if(i.nodeType===8){if(i.data===ce)c.push({type:2,index:a});else{let e=-1;for(;(e=i.data.indexOf(x,e+1))!==-1;)c.push({type:7,index:a}),e+=x.length-1}}a++}}static createElement(e,t){let n=S.createElement(`template`);return n.innerHTML=e,n}};function j(e,t,n=e,r){if(t===O)return t;let i=r===void 0?n._$Cl:n._$Co?.[r],a=w(t)?void 0:t._$litDirective$;return i?.constructor!==a&&(i?._$AO?.(!1),a===void 0?i=void 0:(i=new a(e),i._$AT(e,n,r)),r===void 0?n._$Cl=i:(n._$Co??=[])[r]=i),i!==void 0&&(t=j(e,i._$AS(e,t.values),i,r)),t}var Se=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:n}=this._$AD,r=(e?.creationScope??S).importNode(t,!0);A.currentNode=r;let i=A.nextNode(),a=0,o=0,s=n[0];for(;s!==void 0;){if(a===s.index){let t;s.type===2?t=new Ce(i,i.nextSibling,this,e):s.type===1?t=new s.ctor(i,s.name,s.strings,this,e):s.type===6&&(t=new De(i,this,e)),this._$AV.push(t),s=n[++o]}a!==s?.index&&(i=A.nextNode(),a++)}return A.currentNode=S,r}p(e){let t=0;for(let n of this._$AV)n!==void 0&&(n.strings===void 0?n._$AI(e[t]):(n._$AI(e,n,t),t+=n.strings.length-2)),t++}},Ce=class e{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,n,r){this.type=2,this._$AH=k,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=n,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=j(this,e,t),w(e)?e===k||e==null||e===``?(this._$AH!==k&&this._$AR(),this._$AH=k):e!==this._$AH&&e!==O&&this._(e):e._$litType$===void 0?e.nodeType===void 0?de(e)?this.k(e):this._(e):this.T(e):this.$(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==k&&w(this._$AH)?this._$AA.nextSibling.data=e:this.T(S.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:n}=e,r=typeof n==`number`?this._$AC(e):(n.el===void 0&&(n.el=xe.createElement(ye(n.h,n.h[0]),this.options)),n);if(this._$AH?._$AD===r)this._$AH.p(t);else{let e=new Se(r,this),n=e.u(this.options);e.p(t),this.T(n),this._$AH=e}}_$AC(e){let t=ve.get(e.strings);return t===void 0&&ve.set(e.strings,t=new xe(e)),t}k(t){ue(this._$AH)||(this._$AH=[],this._$AR());let n=this._$AH,r,i=0;for(let a of t)i===n.length?n.push(r=new e(this.O(C()),this.O(C()),this,this.options)):r=n[i],r._$AI(a),i++;i<n.length&&(this._$AR(r&&r._$AB.nextSibling,i),n.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let t=ie(e).nextSibling;ie(e).remove(),e=t}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},M=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,n,r,i){this.type=1,this._$AH=k,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=i,n.length>2||n[0]!==``||n[1]!==``?(this._$AH=Array(n.length-1).fill(new String),this.strings=n):this._$AH=k}_$AI(e,t=this,n,r){let i=this.strings,a=!1;if(i===void 0)e=j(this,e,t,0),a=!w(e)||e!==this._$AH&&e!==O,a&&(this._$AH=e);else{let r=e,o,s;for(e=i[0],o=0;o<i.length-1;o++)s=j(this,r[n+o],t,o),s===O&&(s=this._$AH[o]),a||=!w(s)||s!==this._$AH[o],s===k?e=k:e!==k&&(e+=(s??``)+i[o+1]),this._$AH[o]=s}a&&!r&&this.j(e)}j(e){e===k?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??``)}},we=class extends M{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===k?void 0:e}},Te=class extends M{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==k)}},Ee=class extends M{constructor(e,t,n,r,i){super(e,t,n,r,i),this.type=5}_$AI(e,t=this){if((e=j(this,e,t,0)??k)===O)return;let n=this._$AH,r=e===k&&n!==k||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,i=e!==k&&(n===k||r);r&&this.element.removeEventListener(this.name,this,n),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH==`function`?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},De=class{constructor(e,t,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){j(this,e)}},Oe={M:se,P:x,A:ce,C:1,L:be,R:Se,D:de,V:j,I:Ce,H:M,N:Te,U:Ee,B:we,F:De},ke=re.litHtmlPolyfillSupport;ke?.(xe,Ce),(re.litHtmlVersions??=[]).push(`3.3.3`);var Ae=(e,t,n)=>{let r=n?.renderBefore??t,i=r._$litPart$;if(i===void 0){let e=n?.renderBefore??null;r._$litPart$=i=new Ce(t.insertBefore(C(),e),e,void 0,n??{})}return i._$AI(e),i},je=globalThis,N=class extends b{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Ae(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return O}};N._$litElement$=!0,N.finalized=!0,je.litElementHydrateSupport?.({LitElement:N});var Me=je.litElementPolyfillSupport;Me?.({LitElement:N}),(je.litElementVersions??=[]).push(`4.2.2`);var Ne={attribute:!0,type:String,converter:y,reflect:!1,hasChanged:te},Pe=(e=Ne,t,n)=>{let{kind:r,metadata:i}=n,a=globalThis.litPropertyMetadata.get(i);if(a===void 0&&globalThis.litPropertyMetadata.set(i,a=new Map),r===`setter`&&((e=Object.create(e)).wrapped=!0),a.set(n.name,e),r===`accessor`){let{name:r}=n;return{set(n){let i=t.get.call(this);t.set.call(this,n),this.requestUpdate(r,i,e,!0,n)},init(t){return t!==void 0&&this.C(r,void 0,e,t),t}}}if(r===`setter`){let{name:r}=n;return function(n){let i=this[r];t.call(this,n),this.requestUpdate(r,i,e,!0,n)}}throw Error(`Unsupported decorator location: `+r)};function Fe(e){return(t,n)=>typeof n==`object`?Pe(e,t,n):((e,t,n)=>{let r=t.hasOwnProperty(n);return t.constructor.createProperty(n,e),r?Object.getOwnPropertyDescriptor(t,n):void 0})(e,t,n)}function Ie(e){return Fe({...e,state:!0,attribute:!1})}var Le=class extends Error{constructor(e,t,n){super(n),this.status=e,this.code=t}},Re=class{constructor(e,t,n=(...e)=>fetch(...e)){this.tokens=t,this.fetcher=n,this.baseUrl=e.replace(/\/$/,``)}presets(){return this.request(`/workflow-presets`)}preset(e){return this.request(`/workflow-presets/${encodeURIComponent(e)}`)}createPreset(e){return this.request(`/workflow-presets`,`POST`,e)}updatePreset(e,t){return this.request(`/workflow-presets/${encodeURIComponent(e)}`,`PUT`,t)}deletePreset(e){return this.request(`/workflow-presets/${encodeURIComponent(e)}`,`DELETE`)}tasks(){return this.request(`/tasks`)}packages(){return this.request(`/packages`)}package(e){return this.request(`/packages/${encodeURIComponent(e)}`)}integrations(){return this.request(`/integrations`)}integration(e){return this.request(`/integrations/${encodeURIComponent(e)}`)}refreshIntegration(e){return this.request(`/integrations/${encodeURIComponent(e)}/refresh`,`POST`)}workflows(){return this.request(`/workflows`)}workflow(e){return this.request(`/workflows/${encodeURIComponent(e)}`)}taskRuns(e){return this.request(`/workflows/${encodeURIComponent(e)}/task-runs`)}taskRun(e){return this.request(`/task-runs/${encodeURIComponent(e)}`)}createWorkflow(e){return this.request(`/workflows`,`POST`,e)}command(e,t){return this.request(`/workflows/${encodeURIComponent(e)}/${t}`,`POST`)}resume(e,t){return this.request(`/workflows/${encodeURIComponent(e)}/resume`,`POST`,t)}ticket(){return this.request(`/websocket-tickets`,`POST`)}async request(e,t=`GET`,n){let r=`${this.baseUrl}/api/v1${e}`,i=await this.tokens.getToken(),a=this.tokens.currentRevision;if(!i)throw new Le(401,`api.unauthorized`,`Access token required`);let o=e=>this.fetcher(r,{method:t,headers:{Authorization:`Bearer ${e}`,...n===void 0?{}:{"Content-Type":`application/json`}},...n===void 0?{}:{body:JSON.stringify(n)}}),s=await o(i);if(s.status===401&&(this.tokens.invalidate(a),this.tokens.canRefreshCallback&&(i=await this.tokens.getToken(!0),i&&(s=await o(i)))),!s.ok){let e=`api.request_failed`,t=`Request failed`;try{let n=await s.json();n.error?.code&&(e=n.error.code),n.error?.message&&(t=n.error.message)}catch{}throw new Le(s.status,e,t)}if(s.status!==204)return s.json()}},ze=class{constructor(e){this.configuredToken=null,this.callback=void 0,this.callbackToken=null,this.manualToken=null,this.staticTokenRejected=!1,this.revision=0,this.metaToken=e?.trim()||null}configure(e){if(e.accessToken!==void 0&&e.getAccessToken!==void 0)throw Error(`Configure one token source`);this.configuredToken=e.accessToken?.trim()||null,this.callback=e.getAccessToken,this.callbackToken=null,this.staticTokenRejected=!1,this.revision+=1}get currentRevision(){return this.revision}async getToken(e=!1){if(this.manualToken&&this.staticTokenRejected&&!this.callback)return this.manualToken;if(this.callback){if(e||this.callbackToken===null){let e=this.callback,t=this.revision,n=(await e())?.trim()||null;if(t!==this.revision)return this.getToken();this.callbackToken=n}return this.callbackToken||this.manualToken}return this.staticTokenRejected?this.manualToken:this.configuredToken||this.metaToken||this.manualToken}setManualToken(e){this.manualToken=e.trim()||null}invalidate(e){(e===void 0||e===this.revision)&&(this.staticTokenRejected=!0,this.callbackToken=null)}get canRefreshCallback(){return this.callback!==void 0}};function Be(e){return document.querySelector(`meta[name="${e}"]`)?.content?.trim()||null}var Ve=class{constructor(e,t,n,r=(e,t)=>new WebSocket(e,t)){this.api=e,this.store=t,this.baseUrl=n,this.socketFactory=r,this.connectionState=`disconnected`,this.onStateChange=null,this.socket=null,this.retryTimer=null,this.stopped=!1}async connect(){if(this.stopped=!1,!this.socket){this.setState(`connecting`);try{let e=await this.api.ticket();if(this.stopped)return;let t=new URL(`/api/v1/events`,this.baseUrl);t.protocol=t.protocol===`https:`?`wss:`:`ws:`;let n=this.socketFactory(t.toString(),[e.ticket]);this.socket=n,n.addEventListener(`open`,(()=>{this.socket!==n||this.stopped||(this.setState(`connected`),this.store.resync().catch(()=>{}))})),n.addEventListener(`message`,(e=>{if(!(this.socket!==n||this.stopped))try{let t=JSON.parse(e.data);t&&typeof t.type==`string`&&t.data&&typeof t.data==`object`&&!Array.isArray(t.data)&&this.store.applyEvent(t)}catch{}})),n.addEventListener(`close`,(()=>this.disconnected(n))),n.addEventListener(`error`,(()=>this.disconnected(n)))}catch{this.stopped||this.scheduleReconnect()}}}close(){this.stopped=!0,this.retryTimer!==null&&clearTimeout(this.retryTimer),this.retryTimer=null;let e=this.socket;this.socket=null,e?.close(),this.setState(`disconnected`)}disconnected(e){this.socket===e&&(this.socket=null,e.close(),this.stopped||this.scheduleReconnect())}scheduleReconnect(){this.retryTimer!==null||this.stopped||(this.setState(`reconnecting`),this.retryTimer=setTimeout(()=>{this.retryTimer=null,this.connect()},1e3))}setState(e){this.connectionState=e,this.onStateChange?.()}},He=new Set([`ready`,`waiting`,`preparing`,`needs_attention`]),Ue=class{constructor(e){this.api=e,this.tasks=[],this.presets=[],this.presetsLoading=!1,this.presetError=null,this.presetInflight=null,this.presetReloadQueued=!1,this.packages=[],this.integrations=[],this.integrationDetail=null,this.workflows=[],this.taskRuns=[],this.loading=!1,this.error=null,this.onChange=null,this.inflight=null,this.buffered=[]}get readyPackages(){let e=new Set(this.integrations.map(e=>e.id));return this.packages.filter(t=>t.status===`ready`&&!t.workflow_id&&e.has(t.integration_id))}get selectablePackages(){let e=new Set(this.integrations.map(e=>e.id));return this.packages.filter(t=>He.has(t.status)&&!t.workflow_id&&e.has(t.integration_id))}loadPresets(){return this.presetInflight?this.presetInflight:(this.presetsLoading=!0,this.emit(),this.presetInflight=(async()=>{try{do{this.presetReloadQueued=!1;try{let e=await this.api.presets();if(this.presetReloadQueued)continue;if(!Array.isArray(e)||!e.every(e=>e&&typeof e.code==`string`&&typeof e.name==`string`&&Array.isArray(e.tasks)&&e.tasks.every(e=>typeof e==`string`)&&e.defaults!==null&&typeof e.defaults==`object`&&!Array.isArray(e.defaults)))throw Error(`Preset catalog must contain valid preset documents`);this.presets=e,this.presetError=null}catch(e){this.presetReloadQueued||(this.presetError=e instanceof Error?e.message:`Unable to load presets`)}}while(this.presetReloadQueued)}finally{this.presetsLoading=!1,this.presetInflight=null,this.emit()}})(),this.presetInflight)}reloadPresets(){return this.presetReloadQueued=!0,this.loadPresets()}async loadIntegrationDetail(e){this.integrationDetail=await this.api.integration(e),this.emit()}resync(){if(this.inflight)return this.inflight;this.loading=!0,this.emit();let e=async()=>{try{let[e,t,n,r]=await Promise.all([this.api.tasks(),this.api.packages(),this.api.integrations(),this.api.workflows()]),i=await Promise.all(r.map(e=>this.api.taskRuns(e.id)));this.tasks=e,this.packages=t,this.integrations=n,this.workflows=r,this.taskRuns=i.flat(),this.error=null}catch(e){throw this.error=e instanceof Error?e.message:`Unable to load state`,e}finally{this.loading=!1;let e=this.buffered;this.buffered=[];for(let t of e)this.applyEventNow(t);this.emit()}};return this.inflight=e().finally(()=>{this.inflight=null}),this.inflight}applyEvent(e){if(this.loading){this.buffered.push(e);return}this.applyEventNow(e),this.emit()}applyEventNow(e){let t=e.data;e.type!==`notification`&&typeof t.id==`string`&&(e.type===`workflow.updated`?this.workflows=We(this.workflows,t):e.type===`task_run.updated`?this.taskRuns=We(this.taskRuns,t):e.type===`package.updated`?this.packages=We(this.packages,t):e.type===`integration.updated`&&(this.integrations=We(this.integrations,t)))}emit(){this.onChange?.()}};function We(e,t){let n=e.findIndex(e=>e.id===t.id);if(n===-1)return[...e,t];let r=[...e];return r[n]=t,r}var Ge=o`
  :host {
    display: block;
    box-sizing: border-box;
    color: var(--tf-text);
    background: var(--tf-bg);
    font: 15px/1.5 var(--tf-font-family);
    min-height: 100vh;
  }
  *, *::before, *::after { box-sizing: border-box; }
  button, input, textarea, select { font: inherit; }
  button { cursor: pointer; }
  .app-shell { min-height: 100vh; }
  .topbar { height: 74px; padding: 0 2rem; display: flex; align-items: center;
    justify-content: space-between; border-bottom: 1px solid var(--tf-border); }
  .topbar-controls { display: flex; align-items: center; gap: 1rem; }
  .theme-selector { display: flex; align-items: center; gap: .45rem; color: var(--tf-muted);
    font-size: .78rem; }
  .theme-selector select { width: auto; min-width: 9.5rem; padding: .4rem .55rem; }
  .brand { display: flex; align-items: center; gap: .8rem; }
  .brand strong, .brand small { display: block; }
  .brand strong { letter-spacing: .02em; font-size: 1.1rem; }
  .brand small { color: var(--tf-muted); font-size: .75rem; }
  .brand-mark { display: grid; place-items: center; width: 34px; height: 34px;
    background: var(--tf-accent); color: var(--tf-bg); font-weight: 800; border-radius: 10px; }
  .connection { color: var(--tf-muted); text-transform: capitalize; font-size: .82rem; }
  .connection-dot { display: inline-block; width: 8px; height: 8px; margin-right: .45rem;
    border-radius: 50%; background: var(--tf-accent); }
  .layout { display: grid; grid-template-columns: 220px minmax(0,1fr); }
  .sidebar { padding: 1.5rem .75rem; border-right: 1px solid var(--tf-border);
    display: flex; flex-direction: column; gap: .25rem; }
  .sidebar button { border: 0; border-radius: 9px; padding: .7rem .9rem;
    background: transparent; color: var(--tf-muted); text-align: left; }
  .sidebar button:hover, .sidebar button[aria-current="page"] {
    background: var(--tf-surface); color: var(--tf-text); }
  main { width: 100%; max-width: 1360px; padding: 2.5rem 3rem 5rem; }
  h1, h2, h3, h4, p { margin-top: 0; }
  h2 { font-size: 2rem; line-height: 1.15; margin-bottom: .5rem; }
  h3 { font-size: 1rem; }
  p, small { color: var(--tf-muted); }
  .section-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 2rem; }
  .eyebrow { color: var(--tf-accent); text-transform: uppercase; letter-spacing: .14em;
    font-size: .72rem; font-weight: 700; margin-bottom: .35rem; }
  .count { color: var(--tf-muted); font-size: .85rem; }
  .package-groups { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem; }
  .package-group-heading { display: flex; align-items: center; justify-content: space-between;
    margin-bottom: .75rem; }
  .package-group-heading h3, .package-group-heading h4 { margin: 0; }
  .package-group-heading h3 small { display: block; font-weight: 400; }
  .integration-package-group { min-width: 0; }
  .integration-package-group > summary { cursor: pointer; justify-content: flex-start;
    gap: .65rem; margin-bottom: 0; padding: .75rem 0; list-style: none; }
  .integration-package-group > summary::-webkit-details-marker { display: none; }
  .integration-package-group > summary::before { content: '▸'; flex-shrink: 0; }
  .integration-package-group[open] > summary::before { content: '▾'; }
  .integration-package-group > summary .count { margin-left: auto; text-align: right; }
  .package-status-groups { display: grid; gap: 1.5rem; padding-top: .75rem; }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
  .metric, .panel, .auth-panel { background: var(--tf-surface); border: 1px solid var(--tf-border);
    border-radius: var(--tf-card-radius); padding: 1.35rem; }
  .metric span, .metric strong { display: block; }
  .metric span { color: var(--tf-muted); font-size: .82rem; }
  .metric strong { font-size: 2rem; margin-top: .35rem; }
  .panel-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 1rem;
    margin-top: 1.5rem; }
  .plain-list { padding: 0; margin: 0; list-style: none; }
  .plain-list li { padding: .65rem 0; border-top: 1px solid var(--tf-border);
    display: flex; justify-content: space-between; gap: .5rem; }
  .plain-list small { display: block; }
  .plain-list .text-button { text-align: left; overflow-wrap: anywhere; }
  .plain-list .status { flex-shrink: 0; }
  .status { display: inline-block; border: 1px solid var(--tf-border); padding: .18rem .55rem;
    border-radius: 50px; font-size: .76rem; color: var(--tf-success); white-space: nowrap; }
  .table-wrap { overflow-x: auto; border: 1px solid var(--tf-border);
    border-radius: var(--tf-card-radius); }
  table { border-collapse: collapse; width: 100%; min-width: 700px; }
  th, td { text-align: left; padding: .9rem 1rem; border-bottom: 1px solid var(--tf-border); }
  th { color: var(--tf-muted); font-weight: 600; font-size: .78rem; }
  td small { display: block; }
  .source-path { overflow-wrap: anywhere; }
  tr:last-child td { border-bottom: 0; }
  .text-button { border: 0; background: transparent; color: var(--tf-accent); padding: 0;
    text-decoration: underline; }
  .empty { border: 1px dashed var(--tf-border); padding: 2rem;
    border-radius: var(--tf-card-radius); }
  .notification { border-left: 4px solid var(--tf-accent); background: var(--tf-surface);
    padding: 1rem 1.2rem; margin-bottom: 1.5rem; }
  .notification p { margin-bottom: 0; }
  .notification-list { display: grid; gap: 1rem; margin-top: 1.5rem; }
  .notification-list .notification { margin-bottom: 0; }
  .error { color: var(--tf-error); }
  .run-list { display: grid; gap: 1rem; }
  .run-heading { display: flex; justify-content: space-between; }
  .run-heading small { display: block; }
  .task-progress { display: grid; grid-template-columns: minmax(0, 1fr) 4ch;
    align-items: center; column-gap: .7rem; row-gap: .3rem; margin: .65rem 0 1rem; }
  .task-progress progress { grid-column: 1; width: 100%; accent-color: var(--tf-accent); }
  .task-progress-percent { grid-column: 2; grid-row: 1; color: var(--tf-muted);
    font-size: .78rem; font-variant-numeric: tabular-nums; text-align: right; }
  .task-progress-note { grid-column: 1; grid-row: 2; min-width: 0; color: var(--tf-muted);
    font-size: .78rem; line-height: 1.25; overflow-wrap: anywhere; }
  .task-progress-note--compact { white-space: nowrap;
    font-size: clamp(.62rem, .78vw, .74rem); letter-spacing: -.01em; }
  pre { overflow: auto; font-size: .78rem; color: var(--tf-code-text);
    background: var(--tf-code-bg); white-space: pre-wrap; }
  .auth-panel { max-width: 480px; margin: 3rem auto; }
  .auth-panel form { display: grid; gap: .6rem; }
  fieldset { min-width: 0; }
  legend { color: var(--tf-text); font-weight: 700; padding: 0 .3rem; }
  .option-row { display: flex; gap: .65rem; align-items: start; padding: .55rem 0;
    border-top: 1px solid var(--tf-border); }
  .option-row small { display: block; }
  .form-panel .tmdb-poster-controls { display: flex; flex-wrap: wrap; align-items: end;
    gap: .75rem 1rem; margin-top: .8rem; padding: .8rem 0;
    border-top: 1px solid var(--tf-border); }
  .form-panel .tmdb-poster-control { display: grid; gap: .35rem; margin: 0; }
  .form-panel .tmdb-poster-control--toggle { display: flex; flex-direction: row;
    align-items: center; gap: .5rem; padding-bottom: .55rem; }
  .form-panel .tmdb-poster-control input[type="checkbox"] { display: inline-block;
    width: auto; margin: 0; }
  .form-panel .tmdb-poster-control select { width: auto; padding: .45rem .65rem; }
  .tmdb-candidate > input[type="radio"] { flex: none; width: auto; margin-top: .35rem; }
  .tmdb-candidate-poster { flex: none; align-self: start; border-radius: 7px;
    border: 1px solid var(--tf-border); object-fit: cover; }
  .tmdb-candidate-copy { min-width: 0; }
  .tmdb-result { margin: 0 0 1rem; }
  .tmdb-result strong, .tmdb-result p { display: block; margin: 0 0 .45rem; }
  .tmdb-result-links { margin-top: .7rem; }
  .intro-skip-review { margin: 1rem 0; padding: 1rem; border: 1px solid var(--tf-border); border-radius: 10px; }
  .intro-skip-review > details { margin-top: .8rem; border-top: 1px solid var(--tf-border); padding-top: .7rem; }
  .intro-skip-review > details > summary { cursor: pointer; font-weight: 700; }
  .intro-skip-setting-group { margin-top: .8rem; border: 1px solid var(--tf-border); border-radius: 8px; padding: .8rem; }
  .intro-skip-file-list { max-height: 24rem; overflow: auto; }
  .task-order { padding-left: 1.4rem; }
  .task-order li { padding: .45rem 0; }
  .task-order small { display: block; }
  .inline-actions { display: inline-flex; gap: .25rem; margin-left: .5rem; }
  .inline-actions button, .action-row button, .form-panel button:not(.primary-button) {
    color: var(--tf-text); background: var(--tf-input-bg); border: 1px solid var(--tf-border);
    border-radius: var(--tf-control-radius); padding: .3rem .55rem; }
  .form-panel { margin-top: 1.5rem; }
  .form-panel label { display: block; margin: .8rem 0 .3rem; }
  .form-panel input, .form-panel textarea { display: block; width: 100%; }
  .form-panel .option-row { display: flex; }
  .form-panel .option-row input[type="checkbox"] { width: auto; flex: none; }
  .task-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem 1.5rem; }
  .task-field input, .task-field select { display: block; width: 100%; }
  .task-field small { display: block; margin-top: .4rem; }
  .form-panel .primary-button { margin-top: 1rem; }
  .action-row { display: flex; flex-wrap: wrap; gap: .5rem; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  input, textarea, select { background: var(--tf-input-bg); color: var(--tf-text);
    border: 1px solid var(--tf-border); border-radius: var(--tf-control-radius); padding: .7rem; }
  form button, .primary-button { background: var(--tf-accent); color: var(--tf-bg);
    border: 0; border-radius: var(--tf-control-radius); padding: .7rem 1rem; font-weight: 700; }
  input:focus, textarea:focus, select:focus, button:focus-visible,
  a:focus-visible, summary:focus-visible { outline: 2px solid var(--tf-focus); outline-offset: 3px; }
  @media (max-width: 900px) { .metrics { grid-template-columns: repeat(2,1fr); }
    .layout { grid-template-columns: 1fr; } .sidebar { flex-direction: row; flex-wrap: wrap;
      border-right: 0; border-bottom: 1px solid var(--tf-border); }
    main { padding: 1.5rem; } }
  @media (max-width: 540px) { .metrics, .panel-grid, .task-fields { grid-template-columns: 1fr; }
    .topbar { padding: 0 1rem; } .topbar-controls { gap: .45rem; }
    .theme-selector span { display: none; } .theme-selector select { min-width: 7.5rem; } }
`,Ke=o`
  :host {
    color-scheme: dark;
    --tf-bg: #0b1522;
    --tf-surface: #132236;
    --tf-border: #2a4058;
    --tf-text: #e9f1f9;
    --tf-muted: #9eb1c6;
    --tf-accent: #7ddac0;
    --tf-input-bg: #0b1522;
    --tf-code-bg: #0b1522;
    --tf-code-text: #9eb1c6;
    --tf-error: #ffb2ab;
    --tf-success: #7ddac0;
    --tf-warning: #e0c78c;
    --tf-selected: #132236;
    --tf-focus: #7ddac0;
    --tf-card-radius: 13px;
    --tf-control-radius: 8px;
    --tf-font-family: Inter, system-ui, sans-serif;
  }

  :host([theme="light"]) {
    color-scheme: light;
    --tf-bg: #f4f8fc;
    --tf-surface: #ffffff;
    --tf-border: #cad6e2;
    --tf-text: #10243a;
    --tf-muted: #48627d;
    --tf-accent: #126c5b;
    --tf-input-bg: #ffffff;
    --tf-code-bg: #edf3f8;
    --tf-code-text: #29445f;
    --tf-error: #9b241c;
    --tf-success: #126c5b;
    --tf-selected: #e5f3ef;
    --tf-focus: #126c5b;
  }

  :host([theme="dark"]) {
    color-scheme: dark;
  }

  :host([theme="system"]) {
    color-scheme: light dark;
  }

  @media (prefers-color-scheme: light) {
    :host([theme="system"]) {
      --tf-bg: #f4f8fc;
      --tf-surface: #ffffff;
      --tf-border: #cad6e2;
      --tf-text: #10243a;
      --tf-muted: #48627d;
      --tf-accent: #126c5b;
      --tf-input-bg: #ffffff;
      --tf-code-bg: #edf3f8;
      --tf-code-text: #29445f;
      --tf-error: #9b241c;
      --tf-success: #126c5b;
      --tf-selected: #e5f3ef;
      --tf-focus: #126c5b;
    }
  }

  :host([theme="jspider"]) {
    color-scheme: dark;
    --tf-bg: #111d27;
    --tf-surface: #1b2a35;
    --tf-border: #344651;
    --tf-text: #edf4f5;
    --tf-muted: #a5b7c1;
    --tf-accent: #6ce5be;
    --tf-input-bg: #0e1922;
    --tf-code-bg: #0b151d;
    --tf-code-text: #c9f7e9;
    --tf-error: #ffc1b8;
    --tf-success: #b7f1db;
    --tf-warning: #e0c78c;
    --tf-selected: #142b2b;
    --tf-focus: #6ce5be;
    --tf-card-radius: 10px;
    --tf-control-radius: 8px;
    --tf-font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }

  :host([theme="jspider"]) .topbar {
    background: #111d27;
  }
  :host([theme="jspider"]) .brand strong::after {
    content: '.';
    color: var(--tf-accent);
  }
  :host([theme="jspider"]) .sidebar button:hover,
  :host([theme="jspider"]) .sidebar button[aria-current="page"] {
    background: var(--tf-selected);
    box-shadow: inset 3px 0 #478d7b;
  }
  :host([theme="jspider"]) .metric,
  :host([theme="jspider"]) .panel,
  :host([theme="jspider"]) .auth-panel,
  :host([theme="jspider"]) .table-wrap {
    box-shadow: 0 8px 24px #0002;
  }
  :host([theme="jspider"]) .eyebrow,
  :host([theme="jspider"]) th,
  :host([theme="jspider"]) .preview-label {
    color: var(--tf-muted);
    font-size: .68rem;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
  }
  :host([theme="jspider"]) .status {
    border-color: #478d7b;
  }
  :host([theme="jspider"]) pre,
  :host([theme="jspider"]) code,
  :host([theme="jspider"]) .source-path,
  :host([theme="jspider"]) .task-progress-note {
    font-family: ui-monospace, Consolas, monospace;
  }
`,qe=`taskflow-theme`,Je=[{value:`system`,label:`System`},{value:`dark`,label:`TaskFlow Dark`},{value:`light`,label:`TaskFlow Light`},{value:`jspider`,label:`JSpider`}],Ye=e=>Je.some(t=>t.value===e),Xe=()=>{try{return typeof window>`u`?null:window.localStorage}catch{return null}};function Ze(e=Xe()){if(!e)return`system`;try{let t=e.getItem(qe);return Ye(t)?t:`system`}catch{return`system`}}function Qe(e,t=Xe()){if(t)try{t.setItem(qe,e)}catch{}}function $e(e){return e===`waiting_packages`?`Waiting for packages`:e}function et(e,t){let n=e.creation_payload.packages,r=Array.isArray(n)?n.filter(e=>typeof e==`string`):[],i=new Map(t.map(e=>[e.id,e])),a=r.flatMap(t=>{let n=i.get(t);return n?.workflow_id===e.id&&n.status===`ready`?[]:[{id:t,name:n?.display_name||t,status:n?.status||`unavailable`,note:n?n.workflow_id===e.id?n.note:`Package association unavailable`:`Package unavailable`}]});return{ready:r.length-a.length,total:r.length,blockers:a}}function P(e,t=`—`){let n=e.creation_payload.workflow_name;return typeof n==`string`&&n.trim()?n:t}function tt(e,t){let n=`Workflow ${e.id} (${P(e)})`;if(e.status===`awaiting_input`){let r=t.filter(t=>t.workflow_id===e.id&&t.status===`awaiting_input`),i=r[0]?.task_name;return{title:`Workflow requires intervention`,message:`${n}: ${i?`stage ${i} requires input for ${r.length} task run(s)`:`requires operator input`}. Review and resume the workflow.`}}let r=e.cleanup;if(!r||r.status!==`failed`)return null;let i=r.error;return{title:`Workflow cleanup failed`,message:`${n}: ${i&&typeof i==`object`&&!Array.isArray(i)&&typeof i.message==`string`?i.message:`Review the cleanup error and retry the purge.`}`}}function nt(e,t){let n=e.readyPackages.length,r=e.workflows.filter(e=>[`queued`,`starting`,`running`].includes(e.status)).length,i=e.workflows.map(t=>tt(t,e.taskRuns)).filter(e=>e!==null),a=e.workflows.filter(e=>[`warning`,`awaiting_input`,`failed`].includes(e.status)||e.cleanup?.status===`failed`).length;return D`<section aria-labelledby="dashboard-title">
    <div class="section-heading"><div><p class="eyebrow">Overview</p><h2 id="dashboard-title">Dashboard</h2></div></div>
    ${e.loading?D`<p role="status">Loading current state…</p>`:null}
    ${e.error?D`<p role="alert" class="error">${e.error}</p>`:null}
    <div class="metrics">
      <div class="metric"><span>Ready packages</span><strong>${n}</strong></div>
      <div class="metric"><span>Active workflows</span><strong>${r}</strong></div>
      <div class="metric"><span>Needs attention</span><strong>${a}</strong></div>
      <div class="metric"><span>Loaded tasks</span><strong>${e.tasks.length}</strong></div>
    </div>
    <div class="panel-grid">
      <section class="panel"><h3>Available tasks</h3>
        ${e.tasks.length?D`<ul class="plain-list">${e.tasks.map(e=>D`
          <li><strong>${e.name}</strong><small>${e.description}</small></li>
        `)}</ul>`:D`<p>No tasks loaded.</p>`}
      </section>
      <section class="panel"><h3>Recent workflows</h3>
        ${e.workflows.length?D`<ul class="plain-list">${e.workflows.slice(-5).reverse().map(e=>D`
          <li><span><button class="text-button" type="button" @click=${()=>t(e.id)}>${P(e,e.id)}</button><small>${e.id}</small></span>
            <span class="status">${e.status}</span></li>
        `)}</ul>`:D`<p>No workflows yet.</p>`}
      </section>
    </div>
    ${i.length?D`<div class="notification-list">${i.map(e=>D`
      <aside class="notification" role="alert"><strong>${e.title}</strong>
        <p>${e.message}</p></aside>
    `)}</div>`:null}
  </section>`}var rt={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},it=e=>(...t)=>({_$litDirective$:e,values:t}),at=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,n){this._$Ct=e,this._$AM=t,this._$Ci=n}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}},{I:ot}=Oe,st=e=>e,ct=()=>document.createComment(``),F=(e,t,n)=>{let r=e._$AA.parentNode,i=t===void 0?e._$AB:t._$AA;if(n===void 0)n=new ot(r.insertBefore(ct(),i),r.insertBefore(ct(),i),e,e.options);else{let t=n._$AB.nextSibling,a=n._$AM,o=a!==e;if(o){let t;n._$AQ?.(e),n._$AM=e,n._$AP!==void 0&&(t=e._$AU)!==a._$AU&&n._$AP(t)}if(t!==i||o){let e=n._$AA;for(;e!==t;){let t=st(e).nextSibling;st(r).insertBefore(e,i),e=t}}}return n},I=(e,t,n=e)=>(e._$AI(t,n),e),lt={},ut=(e,t=lt)=>e._$AH=t,dt=e=>e._$AH,ft=e=>{e._$AR(),e._$AA.remove()},pt=(e,t,n)=>{let r=new Map;for(let i=t;i<=n;i++)r.set(e[i],i);return r},L=it(class extends at{constructor(e){if(super(e),e.type!==rt.CHILD)throw Error(`repeat() can only be used in text expressions`)}dt(e,t,n){let r;n===void 0?n=t:t!==void 0&&(r=t);let i=[],a=[],o=0;for(let t of e)i[o]=r?r(t,o):o,a[o]=n(t,o),o++;return{values:a,keys:i}}render(e,t,n){return this.dt(e,t,n).values}update(e,[t,n,r]){let i=dt(e),{values:a,keys:o}=this.dt(t,n,r);if(!Array.isArray(i))return this.ut=o,a;let s=this.ut??=[],c=[],l,u,d=0,f=i.length-1,p=0,m=a.length-1;for(;d<=f&&p<=m;)if(i[d]===null)d++;else if(i[f]===null)f--;else if(s[d]===o[p])c[p]=I(i[d],a[p]),d++,p++;else if(s[f]===o[m])c[m]=I(i[f],a[m]),f--,m--;else if(s[d]===o[m])c[m]=I(i[d],a[m]),F(e,c[m+1],i[d]),d++,m--;else if(s[f]===o[p])c[p]=I(i[f],a[p]),F(e,i[d],i[f]),f--,p++;else if(l===void 0&&(l=pt(o,p,m),u=pt(s,d,f)),l.has(s[d])){if(l.has(s[f])){let t=u.get(o[p]),n=t===void 0?null:i[t];if(n===null){let t=F(e,i[d]);I(t,a[p]),c[p]=t}else c[p]=I(n,a[p]),F(e,i[d],n),i[t]=null;p++}else ft(i[f]),f--}else ft(i[d]),d++;for(;p<=m;){let t=F(e,c[m+1]);I(t,a[p]),c[p++]=t}for(;d<=f;){let e=i[d++];e!==null&&ft(e)}return this.ut=o,ut(e,c),O}}),mt=/^(application|audio|font|image|message|model|multipart|text|video)\/[-!#$%&'+.^_`|~0-9a-z]+$/;function ht(e,t){if(!t.some(t=>t.id===e.integration_id&&t.type===`filesystem`))return null;let n=e.details;if(!n||n.schema_version!==1)return null;let r=n.file,i=n.mime_type;return typeof r!=`string`||!r.startsWith(`/`)||r.includes(`\0`)||r.split(`/`).includes(`..`)||typeof i!=`string`||!mt.test(i)||i===`application/octet-stream`?null:{file:r,mimeType:i}}var gt=new Intl.Collator(`en`,{numeric:!0,sensitivity:`base`});function _t(e,t){let n=new Map(t.map(e=>[e.id,e.code])),r=new Map;for(let t of e){let e=t.integration_id||``,i=r.get(e);i||(i={id:e,label:n.get(e)||e||`Unknown integration`,packages:[]},r.set(e,i)),i.packages.push(t)}let i=e=>typeof e.details?.file==`string`?e.details.file:``;for(let e of r.values())e.packages.sort((e,t)=>gt.compare(e.display_name,t.display_name)||gt.compare(i(e),i(t))||e.id.localeCompare(t.id));return[...r.values()].sort((e,t)=>gt.compare(e.label,t.label)||e.id.localeCompare(t.id))}var vt=[`ready`,`waiting`,`preparing`,`needs_attention`],yt=new Map([[`ready`,`Ready`],[`waiting`,`Waiting`],[`preparing`,`Preparing`],[`needs_attention`,`Needs attention`],[`unavailable`,`Unavailable`]]);function bt(e,t,n=!1){let r=n?e.packages:e.packages.filter(e=>e.status!==`unavailable`),i=_t(r,e.integrations);return D`<section aria-labelledby="packages-title">
    <div class="section-heading"><div><p class="eyebrow">Inputs</p><h2 id="packages-title">Packages</h2></div>
      <span class="count">${r.length} total</span></div>
    <div class="package-groups">${L(i,e=>e.id,n=>{let r=new Map;for(let e of n.packages){let t=r.get(e.status)||[];t.push(e),r.set(e.status,t)}let i=[...r.keys()].filter(e=>!vt.includes(e)&&e!==`unavailable`).sort(),a=[...vt,...i,`unavailable`].filter(e=>r.has(e));return D`<details class="integration-package-group" data-integration-id=${n.id}>
        <summary class="package-group-heading"><h3>${n.label}</h3>
          <span class="count">${n.packages.length} ${n.packages.length===1?`package`:`packages`}</span></summary>
        <div class="package-status-groups">${a.map((i,a)=>{let o=r.get(i),s=`packages-${n.id}-status-${a}`;return D`<section aria-labelledby=${s}>
            <div class="package-group-heading"><h4 id=${s}>${yt.get(i)||i}</h4>
              <span class="count">${o.length} ${o.length===1?`package`:`packages`}</span></div>
            <div class="table-wrap"><table>
              <thead><tr><th scope="col">Package</th><th scope="col">Status</th><th scope="col">Integration</th><th scope="col">Workflow</th><th scope="col">Note</th></tr></thead>
              <tbody>${o.map(n=>{let r=ht(n,e.integrations),i=e.integrations.find(e=>e.id===n.integration_id),a=e.workflows.find(e=>e.id===n.workflow_id);return D`<tr>
                  <td><strong>${n.display_name}</strong><small>${n.id}</small>
                    ${r?D`<small class="source-path">${r.file}</small><small>${r.mimeType}</small>`:null}</td>
                  <td><span class="status">${n.status}</span></td>
                  <td><button class="text-button" type="button" @click=${()=>t(n.integration_id)}>${i?.code||n.integration_id}</button>
                    ${i?D`<small>${n.integration_id}</small>`:null}</td>
                  <td>${a?D`<strong>${P(a)}</strong><small>${a.id}</small>`:n.workflow_id||`Unclaimed`}</td><td>${n.note}</td>
                </tr>`})}</tbody>
            </table></div>
          </section>`})}</div>
      </details>`})}</div>
    ${r.length?null:D`<p class="empty">No packages are available.</p>`}
  </section>`}function xt(e,t=()=>{},n=!1){return D`<section aria-labelledby="integrations-title">
    <div class="section-heading"><div><p class="eyebrow">Providers</p><h2 id="integrations-title">Integrations</h2></div></div>
    ${e.integrationDetail?D`<section class="panel" aria-label="Integration detail">
      <h3>${e.integrationDetail.code}</h3>
      <p>Record ${e.integrationDetail.id} · ${e.integrationDetail.type} · ${e.integrationDetail.status}</p>
      <p>${e.integrationDetail.note}</p>
      <pre>${JSON.stringify(e.integrationDetail.details,null,2)}</pre>
    </section>`:null}
    ${e.integrations.length?D`<div class="table-wrap"><table>
      <thead><tr><th scope="col">Code</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Note</th><th scope="col">Action</th></tr></thead>
      <tbody>${e.integrations.map(e=>D`<tr>
        <td><strong>${e.code}</strong><small>${e.id}</small></td><td>${e.type}</td>
        <td><span class="status">${e.status}</span></td><td>${e.note}</td>
        <td><button class="text-button" type="button" ?disabled=${n}
          @click=${()=>t(e.id)}>Force reconciliation</button></td>
      </tr>`)}</tbody>
    </table></div>`:D`<p class="empty">No live integrations are configured.</p>`}
  </section>`}function St(e,t,n=!1){let r=new Set(e.integrations.filter(e=>e.type===`filesystem`).map(e=>e.id)),i=new Map(e.packages.map(e=>[e.id,e])),a=n?e.workflows:e.workflows.filter(e=>{if(e.status===`waiting_packages`)return!0;let t=e.creation_payload.packages;return!Array.isArray(t)||!t.some(t=>{if(typeof t!=`string`)return!1;let n=i.get(t);return n?.status===`unavailable`&&(!r.has(n.integration_id)||n.workflow_id!==e.id)})});return D`<section aria-labelledby="workflows-title">
    <div class="section-heading"><div><p class="eyebrow">Execution</p><h2 id="workflows-title">Workflows</h2></div>
      <span class="count">${a.length} total</span></div>
    ${a.length?D`<div class="table-wrap"><table>
      <thead><tr><th scope="col">ID</th><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Tasks</th><th scope="col">Note</th><th scope="col">Updated</th></tr></thead>
      <tbody>${[...a].reverse().map(e=>D`<tr>
        <td><button class="text-button" type="button" @click=${()=>t(e.id)}>${e.id}</button></td>
        <td>${P(e)}</td>
        <td><span class="status">${$e(e.status)}</span></td>
        <td>${Array.isArray(e.creation_payload.tasks)?e.creation_payload.tasks.join(` → `):`—`}</td>
        <td>${e.note}</td><td>${e.updated_at||`—`}</td>
      </tr>`)}</tbody>
    </table></div>`:D`<p class="empty">No workflows have been created.</p>`}
  </section>`}var Ct=`https://image.tmdb.org/t/p/w154`;function wt(e){let t=Tt(e);return t?D`<section class="option-row tmdb-candidate tmdb-result" aria-label="Resolved TMDB identity">
    ${t.posterPath?D`<img class="tmdb-candidate-poster"
      src=${`${Ct}${t.posterPath}`} alt=${`${t.title} poster`}
      width="154" height="231" loading="lazy" decoding="async">`:null}
    <div class="tmdb-candidate-copy">
      <strong>${t.title} · ${t.year}</strong>
      <small>Original title: ${t.originalTitle}</small>
      ${t.overview?D`<p>${t.overview}</p>`:null}
      <small class="tmdb-result-links">
        <a href=${`https://www.themoviedb.org/${t.mediaKind}/${t.tmdbId}`}
          target="_blank" rel="noopener noreferrer">TMDB ${t.tmdbId}</a>
        ${t.imdbId?D` · <a href=${`https://www.imdb.com/title/${encodeURIComponent(t.imdbId)}/`}
          target="_blank" rel="noopener noreferrer">IMDb ${t.imdbId}</a>`:null}
        ${t.tvdbId?D` · <a href=${`https://thetvdb.com/dereferrer/series/${t.tvdbId}`}
          target="_blank" rel="noopener noreferrer">TVDB ${t.tvdbId}</a>`:null}
      </small>
    </div>
  </section>`:null}function Tt(e){if(e.task_name!==`tmdb`||e.status!==`succeeded`)return null;let t=Dt(e.outcome_payload?.output),n=Et(e.input_payload);if(!t||!n)return null;let r=Ot(t.tmdb_id),i=R(t.title),a=R(t.original_title),o=Ot(t.year);if(!r||!i||!a||!o||o>9999)return null;let s=kt(t.poster_path)?t.poster_path:void 0;return{mediaKind:n,tmdbId:r,title:i,originalTitle:a,year:o,overview:R(t.overview),posterPath:s,imdbId:R(t.imdb_id),tvdbId:Ot(t.tvdb_id)}}function Et(e){if(e.media_kind===`movie`||e.media_kind===`tv`)return e.media_kind;let t=e.workflow_input;if(!Array.isArray(t))return null;let n=t.map(e=>Dt(e)?.media_kind).filter(e=>e===`movie`||e===`tv`);return n.length&&n.every(e=>e===n[0])?n[0]:null}function Dt(e){return typeof e==`object`&&e&&!Array.isArray(e)?e:null}function R(e){return typeof e==`string`&&e.trim()?e.trim():void 0}function Ot(e){return Number.isInteger(e)&&Number(e)>0?Number(e):void 0}function kt(e){return typeof e==`string`&&e.startsWith(`/`)&&!e.startsWith(`//`)&&!/[\\?#]/.test(e)}function At(e,t){let n=e.workflows.find(e=>e.id===t);if(!n)return D`<section><h2>Workflow not found</h2><p>Refresh to load its current state.</p></section>`;let r=e.taskRuns.filter(e=>e.workflow_id===t),i=tt(n,r),a=et(n,e.packages);return D`<section aria-labelledby="workflow-title">
    <div class="section-heading"><div><p class="eyebrow">Workflow detail</p>
      <h2 id="workflow-title">${P(n)}</h2><small>${n.id}</small></div>
      <span class="status">${$e(n.status)}</span></div>
    <p>${n.note}</p>
    ${i?D`<aside class="notification" role="alert"><strong>${i.title}</strong>
      <p>${i.message}</p></aside>`:null}
    ${n.status===`queued`&&n.queued_operation?D`<p>Waiting for capacity to ${n.queued_operation}.</p>`:null}
    ${n.status===`waiting_packages`?D`<section class="panel" aria-label="Package readiness">
      <h3>Waiting for packages</h3>
      <p>${a.ready} / ${a.total} packages ready.</p>
      <ul>${a.blockers.map(e=>D`<li>
        <strong>${e.name}</strong> · ${e.id} · ${e.status}
        ${e.note?D`<p>${e.note}</p>`:null}
      </li>`)}</ul>
      <p>Starts automatically when every package is ready. Cancel to release the selected packages.</p>
    </section>`:null}
    <div class="panel-grid">
      <section class="panel"><details><summary>Request JSON</summary><pre>${JSON.stringify(n.creation_payload,null,2)}</pre></details></section>
      <section class="panel"><details><summary>Current runtime JSON</summary><pre>${JSON.stringify(n.runtime_payload,null,2)}</pre></details></section>
    </div>
    ${n.cleanup?D`<section class="panel"><h3>Cleanup</h3>
      <pre>${JSON.stringify(n.cleanup,null,2)}</pre>
    </section>`:null}
    <h3>Task runs</h3>
    ${r.length?D`<div class="run-list">${r.map(e=>D`
      <article class="panel task-run">
        <div class="run-heading"><div><strong>${e.task_name}</strong><small>${e.id}${e.input_index===null?``:` · item ${e.input_index+1}`}</small></div>
          <span class="status">${e.status}</span></div>
        <div class="task-progress">
          <progress max="100" value=${e.progress||0} aria-label="${e.task_name} progress"></progress>
          <span class="task-progress-percent">${e.progress||0}%</span>
          <small class="task-progress-note${e.task_name===`intro-skip`?` task-progress-note--compact`:``}">${e.note}</small>
        </div>
        ${wt(e)}
        <details><summary>Input and outcome</summary>
          <h4>Input</h4><pre>${JSON.stringify(e.input_payload,null,2)}</pre>
          <h4>Outcome</h4><pre>${JSON.stringify(e.outcome_payload,null,2)}</pre>
        </details>
      </article>
    `)}</div>`:D`<p class="empty">No task runs yet.</p>`}
  </section>`}function jt(e){return e.normalize(`NFKD`).replace(/[^\x00-\x7F]/g,``).replace(/\s+/g,`_`).replace(/[^A-Za-z0-9_-]/g,``).replace(/[_-]+/g,e=>e.includes(`-`)?`-`:`_`).replace(/^[_-]+|[_-]+$/g,``)}var Mt=[`tmdb`,`unrar`,`extract_dvd_iso`,`media_analysis`,`renamer`,`intro-skip`,`move`],Nt=new Set([`preset`,`packages`,`tasks`,`workflow_input`,`artifacts`,`results`]),Pt=new Set([`__proto__`,`constructor`,`prototype`]);function z(e){let t=e=>{let t=Mt.indexOf(e);return t<0?Mt.length:t};return[...e].sort((e,n)=>t(e.name)-t(n.name)||e.name.localeCompare(n.name))}function Ft(e,t,n,r){if(!n)return e.filter(e=>e!==t);if(e.includes(t))return[...e];let i=[...e,t];return r?t===`extract_dvd_iso`||t===`unrar`?It(i):i:z(i.map(e=>({name:e,description:``,parallel:!1,input_fields:[]}))).map(e=>e.name)}function It(e){if(!e.includes(`unrar`)||!e.includes(`extract_dvd_iso`))return e;let t=e.filter(e=>e!==`extract_dvd_iso`);return t.splice(t.indexOf(`unrar`)+1,0,`extract_dvd_iso`),t}function Lt(e,t,n,r){if(!n)return[];let i=z(t).map(e=>e.name);return It([...new Set(r?[...e.filter(e=>i.includes(e)),...i]:i)])}function B(e){let t;try{t=JSON.parse(e.trim()||`{}`)}catch{throw Error(`Task data must be valid JSON`)}if(!V(t))throw Error(`Task data must be a JSON object`);for(let e of Object.keys(t))if(Nt.has(e)||Pt.has(e))throw Error(`Task data cannot override ${e}`);return t}function V(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function Rt(e){return typeof e==`string`&&e.length>0&&!e.includes(`.`)&&!Pt.has(e)}var zt={key:`media_kind`,path:`media_kind`,label:`Media kind`,type:`string`,description:`Optional. Shared by all tasks. Overrides media_kind supplied by the integration.`,unsetLabel:`Not specified`,choices:[{value:`movie`,label:`Movie`},{value:`tv`,label:`TV series`}]},Bt={key:`cleanup_on_success`,path:`cleanup_on_success`,label:`Cleanup after success`,type:`boolean`,unsetLabel:`Use workflow default`,description:`Default automatic cleanup for workflows created from this preset.`};function Vt(e,t){let n=t.split(`.`),r=e;for(let e=0;e<n.length-1;e+=1){let t=n[e];if(!Object.hasOwn(r,t))return{value:void 0};if(!V(r[t]))return{value:void 0,error:`${n.slice(0,e+1).join(`.`)} must be a JSON object. Edit it in the JSON editor.`};r=r[t]}let i=n[n.length-1];return{value:Object.hasOwn(r,i)?r[i]:void 0}}function Ht(e){return e.choices?.length?e.choices:e.type===`boolean`?[{value:!0,label:`Yes`},{value:!1,label:`No`}]:[]}function H(e,t,n){let r=typeof e.value==`object`?``:String(e.value);return r&&!r.startsWith(`@choice:`)&&n.filter(e=>String(e.value)===r).length===1?r:`@choice:${t}`}function Ut(e,t,n){let r=B(e),i=t.path.split(`.`);if(!i.every(Rt))throw Error(`Task field path is unsafe`);let a=n===``?void 0:n,o=Ht(t);if(n!==``&&o.length){let e=o.findIndex((e,t)=>H(e,t,o)===n);e>=0&&(a=o[e].value)}else if(n!==``&&(t.type===`integer`||t.type===`number`)){let e=t.type===`integer`?/^-?\d+$/:/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/,r=Number(n);e.test(n)&&Number.isFinite(r)&&(!Number.isInteger(r)||Number.isSafeInteger(r))&&(a=r)}else if(n!==``&&(t.type===`object`||t.type===`array`)&&(a=JSON.parse(n),t.type===`object`?!V(a):!Array.isArray(a)))throw Error(`Input must be a JSON ${t.type}`);let s=(e,t)=>{let n=i[t];if(t===i.length-1){a===void 0?delete e[n]:e[n]=a;return}if(Object.hasOwn(e,n)&&!V(e[n]))throw Error(`${i.slice(0,t+1).join(`.`)} must be a JSON object`);let r=Object.hasOwn(e,n)&&V(e[n])?e[n]:{};s(r,t+1),Object.keys(r).length?e[n]=r:delete e[n]};return s(r,0),JSON.stringify(r,null,2)}function Wt(e,t,n,r,i,a,o=``){let{value:s,error:c}=Vt(r,t.path),l=t.type===`object`||t.type===`array`,u=s===void 0?``:l?JSON.stringify(s,null,2):String(s),d=`${e}-${t.path.replaceAll(`.`,`-`)}`,f=Ht(t),p=f.findIndex(e=>JSON.stringify(e.value)===JSON.stringify(s)),m=p>=0?H(f[p],p,f):u,h=p<0&&s!==void 0&&(l?t.type===`object`?!V(s):!Array.isArray(s):s===null||typeof s==`object`||(t.type===`integer`||t.type===`number`)&&typeof s!=`number`&&typeof s!=`string`),g=e=>{let r=e.currentTarget;if(!(i||o||c||h))try{let e=Ut(n,t,r.value);r.setCustomValidity(``),a(e)}catch{r.setCustomValidity(`Input must be a valid JSON ${t.type}`),r.reportValidity()}},_=i||!!o||!!c||h,ee=c||o||(h?`${t.path} has an unsupported JSON value. Edit it in the JSON editor.`:t.description||t.path),v=!t.sensitive&&Object.hasOwn(t,`default`),y=typeof t.default==`string`?t.default:JSON.stringify(t.default);return D`<div class="task-field">
    <label for=${d}>${t.label}</label>
    ${f.length?D`<select id=${d} name=${t.path} aria-describedby=${d+`-hint`}
      ?disabled=${_} @change=${g}>
      <option value="" .selected=${s===void 0}>${t.unsetLabel||`Use integration value or task default`}</option>
      ${s!==void 0&&p<0?D`<option value=${u} selected>JSON value: ${u}</option>`:null}
      ${f.map((e,t)=>D`<option value=${H(e,t,f)}
        .selected=${s!==void 0&&m===H(e,t,f)}>${e.label}</option>`)}
    </select>`:l?D`<textarea id=${d} name=${t.path} rows="3"
      .value=${h?``:u} aria-describedby=${d+`-hint`}
      ?disabled=${_} @input=${g}></textarea>`:D`<input id=${d} name=${t.path}
      type=${t.sensitive?`password`:`text`}
      inputmode=${t.type===`integer`?`numeric`:t.type===`number`?`decimal`:`text`}
      .value=${h?``:u} autocomplete="off" aria-describedby=${d+`-hint`}
      ?disabled=${_} @input=${g}>`}
    <small id=${d+`-hint`}>${ee}</small>
    ${v?D`<small>Task default: ${y}</small>`:null}
  </div>`}function Gt(e,t,n,r=`workflow`){let i={},a=``;try{i=B(e)}catch(e){a=e instanceof Error?e.message:`Invalid task data`}return D`<section class="panel form-panel" data-workflow-parameters aria-label="Workflow parameters">
    <h3>Workflow parameters</h3>
    <p>${r===`preset`?`Set reusable workflow defaults. Leave fields unspecified to fill them when creating a workflow or use integration values.`:`Optional root values shared by all tasks. Leave blank to use values supplied by the integration.`}</p>
    ${a?D`<p class="error" role="alert">${a}. Correct the JSON to edit these fields.</p>`:null}
    <div class="task-fields">${Wt(`workflow`,zt,e,i,t||!!a,n)}
      ${r===`preset`?Wt(`preset`,Bt,e,i,t||!!a,n):null}
    </div>
  </section>`}function Kt(e,t,n,r,i,a=`workflow`){let o={},s=``;try{o=B(n)}catch(e){s=e instanceof Error?e.message:`Invalid task data`}let c=Rt(e.name)?(e.input_fields||[]).filter(e=>Rt(e.key)):[];return D`<section class="panel form-panel" data-task-parameters=${e.name}
    aria-label=${`Parameters for ${e.name}`}>
    <h3>${e.name}</h3><p>${a===`preset`?`Set defaults for this task. You can complete them when creating a workflow; the task validates its inputs when it runs.`:`All fields are optional. Unset fields use integration values, then declared task defaults.`}</p>
    ${s?D`<p class="error" role="alert">${s}. Correct the JSON to edit these fields.</p>`:null}
    <div class="task-fields">${c.map(c=>{let l=(c.unavailable_with_tasks||[]).filter(e=>t.includes(e)),u=l.length?`Unavailable while ${l.join(`, `)} is selected. Existing values are preserved; use the JSON editor to remove them.`:``;return Wt(e.name,{...c,path:e.name+`.`+c.key,...a===`preset`?{unsetLabel:`No preset default`}:{}},n,o,r||!!s,i,u)})}</div>
    ${c.length?null:D`<p>Use the JSON editor to provide data for this task.</p>`}
  </section>`}function qt(e,t,n,r=``,i=!1,a){if(!e.length||new Set(e).size!==e.length)throw Error(`Select at least one distinct ready package`);if((!a?.presetCode||a.tasksOverridden)&&(!t.length||new Set(t).size!==t.length))throw Error(`Select at least one distinct task`);let o=B(n),s=jt(r);if(!s)throw Error(`Enter a workflow name containing ASCII letters or digits`);return{...o,packages:[...e],...a?.presetCode?{preset:a.presetCode}:{},...!a?.presetCode||a.tasksOverridden?{tasks:[...t]}:{},workflow_name:s,...!a?.presetCode||a.cleanupOverridden?{cleanup_on_success:i}:{}}}async function Jt(e,t,n){let r=await e.createWorkflow(t);n?.(r);try{return{workflow:await e.command(r.id,`start`),startError:null}}catch(e){return{workflow:r,startError:e instanceof Error?e:Error(`Unable to start workflow`)}}}function Yt(e,t,n){let r=e.selectablePackages,i=r.filter(e=>t.packageIds.includes(e.id)&&e.status===`ready`).length,a=_t(r,e.integrations),o=r.some(t=>ht(t,e.integrations)!==null),s=t.taskNames.map(t=>e.tasks.find(e=>e.name===t)).filter(e=>e!==void 0),c=jt(t.workflowName||e.packages.find(e=>e.id===t.packageIds[0])?.display_name||``),l=e.presets.find(e=>e.code===t.presetCode);return D`<section aria-labelledby="create-title">
    <div class="section-heading"><div><p class="eyebrow">New execution</p><h2 id="create-title">Create workflow</h2></div></div>
    <section class="panel form-panel"><h3>Preset</h3>
      <label for="workflow-preset">Workflow preset</label>
      <select id="workflow-preset" name="workflow-preset" ?disabled=${t.busy||e.presetsLoading}
        @change=${e=>n.presetChanged?.(e.currentTarget.value)}>
        <option value="" .selected=${!t.presetCode}>No preset</option>
        ${t.presetCode&&!l?D`<option value=${t.presetCode} selected>${t.presetCode} (unavailable)</option>`:null}
        ${e.presets.map(e=>D`<option value=${e.code} .selected=${e.code===t.presetCode}>${e.name} (${e.code})</option>`)}
      </select>
      ${e.presetsLoading?D`<p role="status">Loading presets…</p>`:null}
      ${e.presetError?D`<p role="alert">Unable to load presets: ${e.presetError}</p>
        <button type="button" @click=${()=>void e.loadPresets()}>Retry presets</button>`:null}
      ${t.presetCode?D`<p>Only explicit overrides are sent. The server resolves current preset values at creation.</p>
        <button type="button" data-reset-preset ?disabled=${t.busy||!l} @click=${n.resetPreset}>Reset to preset</button>
        ${l?D`<details><summary>Inherited order and defaults</summary>
          <pre>${JSON.stringify({tasks:l.tasks,...l.defaults},null,2)}</pre></details>`:D`<p role="alert">Selected preset is unavailable. Choose another preset or use no preset.</p>`}`:null}
    </section>
    <section class="panel form-panel"><h3>Workflow name</h3>
      <p>Defaults to the first selected item and can be changed before creation.</p>
      <label for="workflow-name">Name</label>
      <input id="workflow-name" name="workflow_name" type="text" .value=${c}
        @input=${e=>n.nameChanged(jt(e.currentTarget.value))}>
    </section>
    <section class="panel form-panel"><h3>Cleanup</h3>
      ${o?D`<p>Filesystem workflows use the original source files. Cleanup deletes the selected source files.</p>`:null}
      <label class="option-row"><input name="cleanup_on_success" type="checkbox"
        .checked=${t.cleanupOnSuccess}
        @change=${e=>n.cleanupChanged(e.currentTarget.checked)}>
        <span>Cleanup automatically after success<small>Delete source packages and the workflow working directory.</small></span>
      </label>
    </section>
    <div class="panel-grid">
      <fieldset class="panel"><legend>Packages</legend>
        <p>Select one or more package inputs. Start waits until all selected packages are ready.</p>
        <p>${i} / ${t.packageIds.length} selected packages ready.</p>
        ${r.length?D`<div class="package-groups">${L(a,e=>e.id,r=>{let i=r.packages.filter(e=>t.packageIds.includes(e.id)).length;return D`<details class="integration-package-group" data-integration-id=${r.id}>
            <summary class="package-group-heading"><h3>${r.label}<small>${r.id}</small></h3>
              <span class="count">${r.packages.length} ${r.packages.length===1?`package`:`packages`}${i?` · ${i} selected`:``}</span></summary>
            ${r.packages.map(r=>{let i=ht(r,e.integrations);return D`<label class="option-row">
                <input type="checkbox" .checked=${t.packageIds.includes(r.id)}
                  @change=${e=>n.packageChanged(r.id,e.currentTarget.checked)}>
                <span>${r.display_name}<small>${r.id}</small>
                  <small>${r.status}${r.note?` · ${r.note}`:``}</small>
                  ${i?D`<small class="source-path">${i.file}</small><small>${i.mimeType}</small>`:null}</span>
              </label>`})}
          </details>`})}</div>`:D`<p>No selectable unclaimed packages are available.</p>`}
      </fieldset>
      <fieldset class="panel"><legend>Task order</legend>
        <p>Tasks run in the order shown below.</p>
        ${s.length?D`<ol class="task-order">${s.map(e=>D`<li>
          <span>${e.name}<small>${e.description}</small></span>
          <span class="inline-actions"><button type="button" aria-label="Move ${e.name} up"
            @click=${()=>n.moveTask(e.name,-1)}>↑</button>
          <button type="button" aria-label="Move ${e.name} down"
            @click=${()=>n.moveTask(e.name,1)}>↓</button>
          <button type="button" aria-label="Remove ${e.name}"
            @click=${()=>n.taskChanged(e.name,!1)}>×</button></span>
        </li>`)}</ol>`:D`<p>No tasks selected.</p>`}
        <label class="option-row"><input type="checkbox" name="select-all-tasks"
          .checked=${e.tasks.length>0&&e.tasks.every(e=>t.taskNames.includes(e.name))}
          .indeterminate=${e.tasks.some(e=>t.taskNames.includes(e.name))&&!e.tasks.every(e=>t.taskNames.includes(e.name))}
          ?disabled=${t.busy||!e.tasks.length}
          @change=${e=>n.allTasksChanged(e.currentTarget.checked)}>
          <span>All tasks</span></label>
        ${z(e.tasks).map(e=>D`<label class="option-row" data-task-option=${e.name}>
          <input type="checkbox" .checked=${t.taskNames.includes(e.name)}
            @change=${t=>n.taskChanged(e.name,t.currentTarget.checked)}>
          <span>${e.name}<small>${e.description}</small></span>
        </label>`)}
      </fieldset>
    </div>
    ${Gt(t.taskJson,t.busy||!1,n.jsonChanged)}
    ${L(s,e=>e.name,e=>Kt(e,t.taskNames,t.taskJson,t.busy||!1,n.jsonChanged))}
    <section class="panel form-panel"><details><summary>Additional task data JSON</summary>
      <p>${t.presetCode?`The forms and JSON editor contain explicit overrides; blank fields inherit preset values.`:`The forms and this JSON editor update the same task data.`} Add advanced or custom fields here.
        Individual tasks validate their own required fields when executed.</p>
      <label for="task-json">Task data JSON</label>
      <textarea id="task-json" rows="9" spellcheck="false" .value=${t.taskJson}
        @input=${e=>n.jsonChanged(e.currentTarget.value)}></textarea>
      </details>
      <button class="primary-button" type="button" ?disabled=${t.busy||!1}
        @click=${n.submit}>${t.busy?`Creating…`:`Create and start`}</button>
    </section>
  </section>`}function Xt(e,t){return{...e,presetCode:t?.code,taskNames:[...t?.tasks??[]],taskJson:`{}`,cleanupOnSuccess:t?.defaults.cleanup_on_success===!0,tasksOverridden:!1,cleanupOverridden:!1}}var Zt=`https://image.tmdb.org/t/p`,Qt=[{value:`w92`,label:`Small — 92×138`,width:92,height:138},{value:`w154`,label:`Medium — 154×231`,width:154,height:231},{value:`w185`,label:`Large — 185×278`,width:185,height:278}],$t=[1,2,3,4,5];function U(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function en(e){return typeof e==`number`&&Number.isSafeInteger(e)&&e>0}function W(e){if(e.task_name!==`tmdb`||e.status!==`awaiting_input`)return null;let t=e.outcome_payload?.required_input;if(!U(t)||t.kind!==`tmdb.resolve_identity`||![`no_results`,`multiple_results`].includes(String(t.reason))||![`movie`,`tv`].includes(String(t.media_kind))||!U(t.search)||typeof t.search.title!=`string`||!en(t.search.year)||t.search.year>9999||!Array.isArray(t.candidates))return null;let n=t.candidates;return n.some(e=>!U(e)||!en(e.tmdb_id)||typeof e.title!=`string`||!e.title.trim()||e.original_title!==void 0&&typeof e.original_title!=`string`||e.overview!==void 0&&typeof e.overview!=`string`||e.poster_path!==void 0&&!sn(e.poster_path)||e.year!==void 0&&(!en(e.year)||e.year>9999))||t.reason===`no_results`&&n.length!==0||t.reason===`multiple_results`&&n.length<2?null:{reason:t.reason,media_kind:t.media_kind,search:{title:t.search.title,year:t.search.year},candidates:n}}function tn(e){return{mode:e.reason===`no_results`?`search`:`candidate`,candidateId:``,title:e.search.title,year:String(e.search.year),tmdbId:``,showPosters:!0,posterSize:`w154`,maxPosters:5}}var nn=class{constructor(){this.drafts=new Map}sync(e){let t=new Set(e.filter(e=>W(e)).map(e=>e.id));for(let e of this.drafts.keys())t.has(e)||this.drafts.delete(e);for(let n of e)t.has(n.id)&&this.get(n)}get(e){let t=W(e);if(!t)throw Error(`TMDB recovery input is unavailable`);let n=JSON.stringify([e.outcome_payload,e.input_payload]),r=this.drafts.get(e.id);if(r?.fingerprint===n)return r.draft;let i=tn(t);return this.drafts.set(e.id,{fingerprint:n,draft:i}),i}set(e,t){let n=this.drafts.get(e);n&&this.drafts.set(e,{...n,draft:t})}clear(){this.drafts.clear()}};function rn(e,t,n=2**53-1){let r=Number(e.trim());if(!/^\d+$/.test(e.trim())||!en(r)||r>n)throw Error(`${t} must be a positive integer${n===9999?` from 1 to 9999`:``}`);return r}function an(e,t){let n=W(e);if(!n)throw Error(`TMDB recovery input is unavailable`);let r=e.input_payload.tmdb,i=U(r)?{...r}:{};if(t.mode===`candidate`){let e=n.candidates.find(e=>String(e.tmdb_id)===t.candidateId);if(!e)throw Error(`Select a TMDB result`);i.tmdb_id=e.tmdb_id}else if(t.mode===`search`){if(!t.title.trim())throw Error(`Enter a search title`);i.title=t.title.trim(),i.year=rn(t.year,`Search year`,9999),delete i.tmdb_id}else if(t.mode===`id`)i.tmdb_id=rn(t.tmdbId,`TMDB ID`);else throw Error(`Choose a TMDB recovery mode`);return{tmdb:i}}function on(e,t,n,r){let i=Qt.find(e=>e.value===n.posterSize)??Qt[1],a=new Set;if(n.showPosters)for(let e of t.candidates)e.poster_path&&a.size<n.maxPosters&&a.add(e.tmdb_id);let o=(t,i)=>D`
    <label for="tmdb-${e.id}-${t}">${i}</label>
    <input id="tmdb-${e.id}-${t}" name="tmdb-${e.id}-${t}" type="text"
      inputmode=${t===`title`?`text`:`numeric`} .value=${n[t]}
      @input=${e=>r({...n,[t]:e.currentTarget.value})}>`;return D`<fieldset class="tmdb-recovery" data-tmdb-recovery=${e.id}>
    <legend>Resolve TMDB identity</legend>
    <p>${t.reason===`no_results`?`No results found. Change the title and year or enter a TMDB ID.`:`Several results found. Select one, change the search, or enter a TMDB ID.`}</p>
    <label for="tmdb-${e.id}-mode">Resolution method</label>
    <select id="tmdb-${e.id}-mode" name="tmdb-${e.id}-mode" .value=${n.mode}
      @change=${e=>r({...n,mode:e.currentTarget.value})}>
      ${t.candidates.length?D`<option value="candidate">Select a result</option>`:null}
      <option value="search">Search again</option><option value="id">Enter TMDB ID</option>
    </select>
    ${n.mode===`candidate`?D`
      ${t.candidates.some(e=>e.poster_path)?D`
        <div class="tmdb-poster-controls" data-tmdb-poster-controls>
          <label class="tmdb-poster-control tmdb-poster-control--toggle">
            <input type="checkbox" data-tmdb-show-posters .checked=${n.showPosters}
              @change=${e=>r({...n,showPosters:e.currentTarget.checked})}>
            <span>Show posters</span>
          </label>
          <label class="tmdb-poster-control"><span>Size</span>
            <select data-tmdb-poster-size ?disabled=${!n.showPosters}
              @change=${e=>r({...n,posterSize:e.currentTarget.value})}>
              ${Qt.map(e=>D`<option value=${e.value}
                ?selected=${e.value===n.posterSize}>${e.label}</option>`)}
            </select>
          </label>
          <label class="tmdb-poster-control"><span>Max posters</span>
            <select data-tmdb-max-posters ?disabled=${!n.showPosters}
              @change=${e=>r({...n,maxPosters:Number(e.currentTarget.value)})}>
              ${$t.map(e=>D`<option value=${String(e)}
                ?selected=${e===n.maxPosters}>${e}</option>`)}
            </select>
          </label>
        </div>`:null}
      <div class="tmdb-candidates">
      ${t.candidates.map(o=>D`<label class="option-row tmdb-candidate">
        <input type="radio" name="tmdb-${e.id}-candidate" value=${String(o.tmdb_id)}
          .checked=${n.candidateId===String(o.tmdb_id)}
          @change=${()=>r({...n,candidateId:String(o.tmdb_id)})}>
        ${o.poster_path&&a.has(o.tmdb_id)?D`<img
          class="tmdb-candidate-poster"
          src=${`${Zt}/${i.value}${o.poster_path}`}
          alt=${`${o.title} poster`} width=${i.width} height=${i.height}
          loading="lazy" decoding="async">`:null}
        <span class="tmdb-candidate-copy">${o.title} · ${o.year??`Unknown year`} · <a
          href=${`https://www.themoviedb.org/${t.media_kind}/${o.tmdb_id}`}
          target="_blank" rel="noopener noreferrer">TMDB ${o.tmdb_id}</a>
          ${o.original_title?D`<small>Original title: ${o.original_title}</small>`:null}
          ${o.overview?D`<small>${o.overview}</small>`:null}</span>
      </label>`)}
    </div>`:n.mode===`search`?D`${o(`title`,`Search title`)}${o(`year`,`Search year`)}`:o(`tmdbId`,`TMDB ID`)}
  </fieldset>`}function sn(e){return typeof e==`string`&&e.startsWith(`/`)&&!e.startsWith(`//`)&&!/[\\?#]/.test(e)}function G(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function cn(e){return typeof e==`number`&&Number.isSafeInteger(e)&&e>=0}function K(e){if(e.task_name!==`extract_dvd_iso`||e.status!==`awaiting_input`)return null;let t=e.outcome_payload?.required_input;if(!G(t)||t.kind!==`extract_dvd_iso.select_titles`||![`multiple_titles`,`invalid_selection`,`stale_selection`].includes(String(t.reason))||typeof t.source!=`string`||!t.source||typeof t.scan_fingerprint!=`string`||!t.scan_fingerprint||t.selection_mode!==void 0&&t.selection_mode!==`per_source`||!Array.isArray(t.candidates)||t.candidates.length===0)return null;let n=new Set;for(let e of t.candidates){if(!G(e)||!cn(e.title_id)||n.has(e.title_id)||!cn(e.duration_ms)||e.duration_ms<=6e5||e.name!==null&&e.name!==void 0&&typeof e.name!=`string`||typeof e.filename!=`string`||!e.filename||e.size_bytes!==null&&!cn(e.size_bytes)||!Array.isArray(e.streams)||e.streams.some(e=>!G(e)||typeof e.kind!=`string`||typeof e.codec!=`string`||typeof e.language!=`string`))return null;n.add(e.title_id)}return t}var ln=class{constructor(){this.drafts=new Map}sync(e){let t=new Set(e.filter(K).map(e=>e.id));for(let e of this.drafts.keys())t.has(e)||this.drafts.delete(e);for(let n of e)t.has(n.id)&&this.get(n)}get(e){let t=K(e);if(!t)throw Error(`DVD ISO recovery input is unavailable`);let n=JSON.stringify([t.source,t.scan_fingerprint,t.candidates,t.selection_mode]),r=this.drafts.get(e.id);if(r?.fingerprint===n)return r.draft;let i={};return this.drafts.set(e.id,{fingerprint:n,draft:i}),i}set(e,t){let n=this.drafts.get(e);n&&this.drafts.set(e,{...n,draft:t})}clear(){this.drafts.clear()}};function un(e,t){let n=K(e);if(!n)throw Error(`DVD ISO recovery input is unavailable`);if(n.candidates.some(e=>![`keep`,`discard`].includes(t[e.title_id])))throw Error(`Decide every DVD title`);let r=n.candidates.filter(e=>t[e.title_id]===`keep`).map(e=>e.title_id);if(!r.length)throw Error(`Keep at least one DVD title`);let i=n.candidates.filter(e=>t[e.title_id]===`discard`).map(e=>e.title_id),a=e.input_payload.extract_dvd_iso,o=G(a)?a:{},s={scan_fingerprint:n.scan_fingerprint,keep_title_ids:r,discard_title_ids:i};return{extract_dvd_iso:{...o,...n.selection_mode===`per_source`?{selections:{...G(o.selections)?o.selections:{},[n.source]:s}}:{selection:s}}}}function dn(e){let t=Math.floor(e/1e3),n=Math.floor(t/3600),r=Math.floor(t/60)%60;return`${n?`${n}:${String(r).padStart(2,`0`)}`:r}:${String(t%60).padStart(2,`0`)}`}function fn(e,t,n,r){return D`<fieldset data-dvd-iso-recovery=${e.id}>
    <legend>Select DVD titles · ${e.id}</legend>
    <p>${t.source}</p>
    <p>${t.reason===`stale_selection`?`The DVD scan changed. Review the titles again.`:t.reason===`invalid_selection`?`The previous selection is incomplete or invalid.`:`Several titles are longer than ten minutes.`}
      Decide which titles to keep. Each retained title produces a separate MKV with all its audio and subtitles.</p>
    ${t.candidates.map(t=>D`<fieldset>
      <legend>Title ${t.title_id} · ${t.name||`Unnamed title`}</legend>
      <p>${t.filename}</p>
      <p>Duration: ${dn(t.duration_ms)} · Estimated size:
        ${t.size_bytes===null?`Unknown`:`${(t.size_bytes/1073741824).toFixed(2)} GiB`}</p>
      <p>${t.streams.map(e=>`${e.kind} · ${e.codec} · ${e.language}`).join(`; `)}</p>
      ${[`keep`,`discard`].map(i=>D`<label class="option-row">
        <input type="radio" name=${`dvd-${e.id}-${t.title_id}`} value=${i}
          .checked=${n[t.title_id]===i}
          @change=${()=>r({...n,[t.title_id]:i})}>
        <span>${i===`keep`?`Keep`:`Discard`}</span>
      </label>`)}
    </fieldset>`)}
  </fieldset>`}function pn(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function mn(e){return typeof e==`number`&&Number.isSafeInteger(e)&&e>=0}function q(e){if(e.task_name!==`extract_dvd_iso`||e.status!==`awaiting_input`)return null;let t=e.outcome_payload?.required_input;return!pn(t)||t.kind!==`extract_dvd_iso.review_warnings`||t.reason!==`makemkv_warnings`||typeof t.review_fingerprint!=`string`||!t.review_fingerprint||typeof t.description!=`string`||!t.description||!Array.isArray(t.warnings)||!t.warnings.length||t.warnings.some(e=>!pn(e)||!mn(e.code)||typeof e.source!=`string`||!e.source||![`scan`,`extract`].includes(String(e.phase))||e.title_id!==null&&!mn(e.title_id)||typeof e.message!=`string`||!e.message||typeof e.description!=`string`||!e.description)?null:t}var hn=class{constructor(){this.drafts=new Map}sync(e){let t=new Set(e.filter(q).map(e=>e.id));for(let e of this.drafts.keys())t.has(e)||this.drafts.delete(e);for(let n of e)t.has(n.id)&&this.get(n)}get(e){let t=q(e);if(!t)throw Error(`DVD ISO warning review is unavailable`);let n=JSON.stringify(t),r=this.drafts.get(e.id);return r?.fingerprint===n?r.decision:(this.drafts.set(e.id,{fingerprint:n,decision:null}),null)}set(e,t){let n=this.drafts.get(e);n&&this.drafts.set(e,{...n,decision:t})}clear(){this.drafts.clear()}};function gn(e,t){let n=q(e);if(!n)throw Error(`DVD ISO warning review is unavailable`);if(t!==`succeed`&&t!==`fail`)throw Error(`Choose success or failure for the MakeMKV warnings`);let r=e.input_payload.extract_dvd_iso;return{extract_dvd_iso:{...pn(r)?r:{},warning_review:{fingerprint:n.review_fingerprint,decision:t}}}}function _n(e,t,n,r){return D`<fieldset data-dvd-warning-review=${e.id}>
    <legend>Review MakeMKV warnings · ${e.id}</legend>
    <p>Extraction has completed. Review the warnings and choose whether this task succeeds or fails.</p>
    ${t.warnings.map(e=>D`<fieldset>
      <legend>MakeMKV ${e.code} · ${e.phase}${e.title_id===null?``:` · Title ${e.title_id}`}</legend>
      <p>${e.source}</p>
      <p>${e.message}</p>
      <pre>${e.description}</pre>
    </fieldset>`)}
    ${[`succeed`,`fail`].map(t=>D`<label class="option-row">
      <input type="radio" name=${`dvd-warning-${e.id}`} value=${t}
        .checked=${n===t} @change=${()=>r(t)}>
      <span>${t===`succeed`?`Complete successfully`:`Fail task`}</span>
    </label>`)}
  </fieldset>`}function J(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function vn(e){return typeof e==`number`&&Number.isSafeInteger(e)&&e>=0}function Y(e){if(e.task_name!==`intro-skip`||e.status!==`awaiting_input`)return null;let t=e.outcome_payload?.required_input;return!J(t)||t.kind!==`intro-skip.review_missing`||typeof t.cache_token!=`string`||!t.cache_token||!J(t.summary)||!vn(t.summary.total)||!vn(t.summary.ok)||!vn(t.summary.missing)||!vn(t.summary.accepted)||!Array.isArray(t.files)||!t.files.length||t.files.some(e=>!J(e)||typeof e.path!=`string`||typeof e.label!=`string`||![`ok`,`missing`,`accepted`].includes(String(e.status)))||!Array.isArray(t.settings)||t.settings.length!==63||t.settings.some(e=>!J(e)||typeof e.key!=`string`||typeof e.label!=`string`||typeof e.category!=`string`||![`smart`,`advanced`].includes(String(e.view))||![`boolean`,`integer`,`number`,`string`].includes(String(e.type))||typeof e.description!=`string`||typeof e.use_case!=`string`)?null:t}var yn=class{constructor(){this.drafts=new Map}sync(e){let t=new Set(e.filter(Y).map(e=>e.id));for(let e of this.drafts.keys())t.has(e)||this.drafts.delete(e);for(let n of e)t.has(n.id)&&this.get(n)}get(e){let t=Y(e);if(!t)throw Error(`Intro Skip review is unavailable`);let n=JSON.stringify(t),r=this.drafts.get(e.id);if(r?.fingerprint===n)return r.draft;let i={action:`retry`,selected:new Set(t.files.filter(e=>e.status===`missing`).map(e=>e.path)),values:Object.fromEntries(t.settings.map(e=>[e.key,e.inherited]))};return this.drafts.set(e.id,{fingerprint:n,draft:i}),i}update(e,t){let n=this.get(e),r=this.drafts.get(e.id);this.drafts.set(e.id,{...r,draft:{...n,...t}})}clear(){this.drafts.clear()}};function bn(e,t,n){if(!n.selected.size)throw Error(`Select at least one missing episode`);let r=new Set(t.files.filter(e=>e.status===`missing`).map(e=>e.path));if([...n.selected].some(e=>!r.has(e)))throw Error(`Only missing episodes can be selected`);let i={};if(n.action===`retry`)for(let e of t.settings)n.values[e.key]!==e.inherited&&(i[e.key]=n.values[e.key]);let a=e.input_payload[`intro-skip`];return{"intro-skip":{...J(a)?a:{},review:{cache_token:t.cache_token,action:n.action,selected_paths:[...n.selected],engine_overrides:i}}}}function xn(e,t,n,r){let i=e=>[...new Set(t.settings.filter(t=>t.view===e).map(e=>e.category))],a=e=>D`${i(e).map(i=>D`
    <fieldset class="intro-skip-setting-group"><legend>${i}</legend>
      <div class="task-fields">${t.settings.filter(t=>t.view===e&&t.category===i).map(e=>Sn(e,n.values[e.key],t=>r({values:{...n.values,[e.key]:t}})))}</div>
    </fieldset>`)}`;return D`<fieldset class="intro-skip-review" data-intro-skip-review=${e.id}>
    <legend>Review Intro Skip results · ${e.id}</legend>
    <p>${t.summary.ok}/${t.summary.total} intros found · ${t.summary.missing} require review</p>
    <div class="intro-skip-file-list">${t.files.map(e=>D`<label class="option-row">
      <input type="checkbox" .checked=${n.selected.has(e.path)} ?disabled=${e.status!==`missing`}
        @change=${t=>{let i=new Set(n.selected);t.currentTarget.checked?i.add(e.path):i.delete(e.path),r({selected:i})}}>
      <span><strong>${e.label}</strong><small>${e.status.toUpperCase()} · ${Cn(e)}</small></span>
    </label>`)}</div>
    <label>Action<select .value=${n.action}
      @change=${e=>r({action:e.currentTarget.value})}>
      <option value="retry">Repeat again</option>
      <option value="accept">Accept selected without intro</option>
    </select></label>
    <details><summary>Smart settings · 15</summary>${a(`smart`)}</details>
    <details><summary>Advanced settings · 48</summary>${a(`advanced`)}</details>
  </fieldset>`}function Sn(e,t,n){let r=e.type===`boolean`?D`<input type="checkbox" .checked=${!!t}
        @change=${e=>n(e.currentTarget.checked)}>`:D`<input type=${e.type===`string`?`text`:`number`}
        step=${e.type===`number`?`any`:`1`} .value=${String(t)}
        @change=${t=>{let r=t.currentTarget.value;n(e.type===`string`?r:Number(r))}}>`;return D`<label class="task-field"><span>${e.label}</span>${r}
    <small>${e.description}<br>${e.use_case}</small></label>`}function Cn(e){return`${e.introduction?`Intro ${wn(e.introduction.start_ms)}–${wn(e.introduction.end_ms)}`:`Intro missing`} · ${e.credits_start_ms===null?`Credits missing`:`Credits ${wn(e.credits_start_ms)}`}`}function wn(e){let t=Math.floor(e/1e3);return`${Math.floor(t/60)}:${String(t%60).padStart(2,`0`)}`}var Tn=`REPLACE_WITH_movie_OR_tv`,En=`REPLACE_WITH_ARCHIVE_PASSWORD`;function X(e){return typeof e==`object`&&!!e&&!Array.isArray(e)}function Dn(e){if(e.status!==`awaiting_input`)return!1;let t=e.outcome_payload;return!X(t)||t.status!==`failed`||!X(t.error)||typeof t.error.code!=`string`||!t.error.code.endsWith(`.invalid_input`)?!1:[t.note,t.details].some(e=>typeof e==`string`&&e.includes(`media_kind must be movie or tv`))}function On(e){if(e.task_name!==`unrar`||e.status!==`awaiting_input`)return!1;let t=e.outcome_payload?.required_input;return!X(t)||!X(t.unrar)||!X(t.unrar.password)?!1:t.unrar.password.type===`string`&&t.unrar.password.required===!0}function kn(e){return e.some(Dn)?JSON.stringify({media_kind:Tn},null,2):`{}`}function An(e){return On(e)?JSON.stringify({unrar:{password:En}},null,2):``}function Z(e){return e===`REPLACE_WITH_movie_OR_tv`||e===`REPLACE_WITH_ARCHIVE_PASSWORD`?!0:Array.isArray(e)?e.some(Z):X(e)&&Object.values(e).some(Z)}function jn(e,t=!1,n=null,r=null){return e===`created`||e===`warning`?[`start`,`cancel`]:e===`waiting_packages`?[`cancel`]:e===`queued`?r===`start`||r===`resume`?[`cancel`]:[]:e===`running`?[`pause`,`stop`]:e===`awaiting_input`?[`pause`,`stop`,`resume`]:e===`paused`?[`stop`,`resume`]:e===`stopped`?[`resume`,`abandon`]:t&&e===`succeeded`?n===null?[`release-packages`,`purge`]:n===`running`||n===`completed`?[]:[`purge`]:t&&e===`failed`?[`release-packages`]:[]}function Mn(e,t){let n;try{n=JSON.parse(e.trim()||`{}`)}catch{throw Error(`${t} must be valid JSON`)}if(typeof n!=`object`||!n||Array.isArray(n))throw Error(`${t} must be a JSON object`);return n}function Nn(e,t,n){let r=Mn(t,`Runtime patch`);for(let e of[`packages`,`tasks`,`workflow_input`,`artifacts`,`results`])if(e in r)throw Error(`Runtime patch cannot override ${e}`);let i=e.filter(e=>e.status===`awaiting_input`).filter(e=>(n[e.id]||``).trim()).map(e=>({task_run_id:e.id,input:Mn(n[e.id],`Input for ${e.id}`)}));if(Z(r)||i.some(e=>Z(e.input)))throw Error(`Replace all resume JSON placeholders`);return{runtime_patch:r,task_inputs:i}}function Pn(e,t,n,r,i,a=!1,o={state:new nn,changed:()=>{}}){let s=typeof e.cleanup?.status==`string`?e.cleanup.status:null,c=jn(e.status,a,s,e.queued_operation),l=t.filter(e=>e.status===`awaiting_input`);o.state.sync(l);let u=o.dvdState??=new ln;u.sync(l);let d=o.warningState??=new hn;d.sync(l);let f=o.introSkipState??=new yn;return f.sync(l),D`<section class="panel form-panel" aria-label="Workflow actions">
    <h3>Actions</h3>
    ${c.length?D`<div class="action-row">${c.filter(e=>e!==`resume`).map(e=>D`
      <button type="button" @click=${()=>{(e!==`abandon`||window.confirm(`Abandon this workflow? It will fail and release all associated packages. This cannot be undone.`))&&(e!==`release-packages`||window.confirm(`Release this workflow’s packages? Ready packages can then be selected for another workflow. This cannot be undone.`))&&(e!==`purge`||window.confirm(`Purge this workflow? Source packages, source files, and the workflow working directory will be deleted. This cannot be undone.`))&&n(e)}}>
        ${e===`abandon`?`Abandon workflow`:e===`release-packages`?`Release packages`:e===`purge`?`Purge workflow`:e[0].toUpperCase()+e.slice(1)}
      </button>`)}</div>`:D`<p>No actions available for this status.</p>`}
    ${e.status===`awaiting_input`?D`<form @submit=${e=>{e.preventDefault();let t=e.currentTarget,n=t.elements.namedItem(`runtime_patch`),a={};if(!o.busy)try{for(let e of l)a[e.id]=q(e)?JSON.stringify(gn(e,d.get(e))):K(e)?JSON.stringify(un(e,u.get(e))):Y(e)?JSON.stringify(bn(e,Y(e),f.get(e))):W(e)?JSON.stringify(an(e,o.state.get(e))):t.elements.namedItem(`task_${e.id}`).value;r(Nn(l,n.value,a))}catch(e){i?.(e instanceof Error?e.message:`Invalid resume input`)}}}>
      <h4>Resume blocked task runs</h4>
      ${l.map(e=>{let t=q(e);if(t)return _n(e,t,d.get(e),t=>{d.set(e.id,t),o.changed()});let n=K(e);if(n)return fn(e,n,u.get(e),t=>{u.set(e.id,t),o.changed()});let r=Y(e);if(r)return xn(e,r,f.get(e),t=>{f.update(e,t),o.changed()});let i=W(e);return i?on(e,i,o.state.get(e),t=>{o.state.set(e.id,t),o.changed()}):null})}
      <details><summary>Advanced resume JSON</summary>
      <label for="runtime_patch">Workflow runtime patch JSON</label>
      <textarea id="runtime_patch" name="runtime_patch" rows="4" spellcheck="false"
        >${kn(l)}</textarea>
      ${l.filter(e=>!W(e)&&!K(e)&&!q(e)&&!Y(e)).map(e=>D`<label for="task_${e.id}">Input patch for ${e.task_name} · ${e.id}</label>
        <textarea id="task_${e.id}" name="task_${e.id}" rows="4" spellcheck="false"
          placeholder="Optional JSON object">${An(e)}</textarea>`)}
      </details>
      <button class="primary-button" type="submit" ?disabled=${o.busy||!1}>Resume</button>
    </form>`:c.includes(`resume`)?D`<button type="button"
      @click=${()=>r({runtime_patch:{},task_inputs:[]})}>Resume</button>`:null}
  </section>`}var Fn=()=>({code:``,name:``,tasks:[],defaultsJson:`{}`}),In=class{constructor(){this.draft=Fn(),this.editingCode=null,this.open=!1,this.busy=!1,this.error=``,this.notice=``,this.deletingCode=null}edit(e){this.editingCode=e?.code??null,this.draft=e?{code:e.code,name:e.name,tasks:[...e.tasks],defaultsJson:JSON.stringify(e.defaults,null,2)}:Fn(),this.error=``,this.notice=``,this.open=!0}duplicate(e){this.edit(e),this.editingCode=null,this.draft.code=``}async save(e,t){if(!this.busy){this.error=``,this.notice=``,this.busy=!0,t();try{let t;try{t=JSON.parse(this.draft.defaultsJson)}catch{throw Error(`Defaults must be valid JSON`)}if(!t||typeof t!=`object`||Array.isArray(t))throw Error(`Defaults must be a JSON object`);let n={code:this.draft.code,name:this.draft.name,tasks:[...this.draft.tasks],defaults:t};if(this.editingCode){let{code:t,...r}=n;await e.api.updatePreset(this.editingCode,r)}else await e.api.createPreset(n);this.open=!1,this.notice=`Preset saved`,await e.reloadPresets()}catch(e){this.error=e instanceof Error?e.message:`Unable to save preset`}finally{this.busy=!1,t()}}}async delete(e,t){if(this.busy||!this.deletingCode)return;let n=this.deletingCode;this.busy=!0,this.error=``,t();try{await e.api.deletePreset(n),this.deletingCode=null,this.editingCode===n&&(this.open=!1),this.notice=`Preset deleted`,await e.reloadPresets()}catch(e){this.error=e instanceof Error?e.message:`Unable to delete preset`}finally{this.busy=!1,t()}}};function Ln(e,t,n){let r=e=>{e(),n()},i=e=>r(()=>{t.draft.defaultsJson=e,t.error=``}),a=t.draft.tasks.flatMap(t=>{let n=e.tasks.find(e=>e.name===t);return n?[n]:[]}),o=(e,n)=>r(()=>{let r=e+n;if(r<0||r>=t.draft.tasks.length)return;let i=[...t.draft.tasks];[i[e],i[r]]=[i[r],i[e]],t.draft.tasks=i});return D`<section aria-labelledby="presets-title">
    <div class="section-heading"><div><p class="eyebrow">Reusable configuration</p><h2 id="presets-title">Presets</h2></div>
      <button type="button" data-new-preset ?disabled=${t.busy} @click=${()=>r(()=>t.edit())}>New preset</button></div>
    ${e.presetsLoading?D`<p role="status">Loading presets…</p>`:null}
    ${e.presetError?D`<p role="alert">Unable to load presets: ${e.presetError}</p>
      <button type="button" @click=${()=>void e.loadPresets()}>Retry presets</button>`:null}
    ${t.error?D`<p role="alert">${t.error}</p>`:null}
    ${t.notice?D`<p role="status">${t.notice}</p>`:null}
    <section class="panel"><h3>Saved presets</h3>
      ${e.presets.length?D`<ul>${e.presets.map(e=>D`<li>
        <strong>${e.name}</strong> <small>${e.code}</small>
        <p>${e.tasks.join(` → `)}</p>
        <button type="button" data-edit-preset=${e.code} ?disabled=${t.busy}
          @click=${()=>r(()=>t.edit(e))}>Edit ${e.name}</button>
        <button type="button" data-duplicate-preset=${e.code} ?disabled=${t.busy}
          @click=${()=>r(()=>t.duplicate(e))}>Duplicate ${e.name}</button>
        <button type="button" data-delete-preset=${e.code} ?disabled=${t.busy}
          @click=${()=>r(()=>{t.deletingCode=e.code,t.error=``})}>Delete ${e.name}</button>
      </li>`)}</ul>`:D`<p>No presets saved.</p>`}
    </section>
    ${t.deletingCode?D`<section class="panel" role="alertdialog" aria-label="Confirm preset deletion">
      <p>Delete preset ${t.deletingCode}? Already-created workflows keep their saved configuration.</p>
      <button type="button" data-confirm-delete ?disabled=${t.busy} @click=${()=>void t.delete(e,n)}>Confirm deletion</button>
      <button type="button" ?disabled=${t.busy} @click=${()=>r(()=>{t.deletingCode=null})}>Cancel deletion</button>
    </section>`:null}
    ${t.open?D`<section class="panel form-panel"><h3>${t.editingCode?`Edit preset`:`New preset`}</h3>
      <fieldset ?disabled=${t.busy}>
        <label for="preset-code">Code</label>
        <input id="preset-code" name="preset-code" .value=${t.draft.code} ?disabled=${!!t.editingCode}
          @input=${e=>{t.draft.code=e.currentTarget.value}}>
        <p>Use a stable lowercase slug. The code cannot change after creation.</p>
        <label for="preset-name">Name</label>
        <input id="preset-name" name="preset-name" .value=${t.draft.name}
          @input=${e=>{t.draft.name=e.currentTarget.value}}>
        <h4>Task order</h4><p>Tasks run in this exact order. Select tasks to append them.</p>
        <ol class="task-order">${t.draft.tasks.map((e,n)=>D`<li><span>${e}</span><span class="inline-actions">
          <button type="button" aria-label=${`Move ${e} up`} ?disabled=${n===0} @click=${()=>o(n,-1)}>↑</button>
          <button type="button" aria-label=${`Move ${e} down`} ?disabled=${n===t.draft.tasks.length-1} @click=${()=>o(n,1)}>↓</button>
          <button type="button" aria-label=${`Remove ${e}`} @click=${()=>r(()=>{t.draft.tasks=t.draft.tasks.filter(t=>t!==e)})}>×</button>
        </span></li>`)}</ol>
        ${z(e.tasks).map(e=>D`<label class="option-row"><input type="checkbox" data-preset-task=${e.name}
          .checked=${t.draft.tasks.includes(e.name)} @change=${n=>r(()=>{t.draft.tasks=n.currentTarget.checked?[...t.draft.tasks,e.name]:t.draft.tasks.filter(t=>t!==e.name)})}><span>${e.name}<small>${e.description}</small></span></label>`)}
        ${Gt(t.draft.defaultsJson,t.busy,i,`preset`)}
        ${L(a,e=>e.name,e=>Kt(e,t.draft.tasks,t.draft.defaultsJson,t.busy,i,`preset`))}
        <details><summary>Advanced defaults JSON</summary>
          <p>The forms and this editor update the same defaults. Add custom fields here.</p>
          <label for="preset-defaults">Defaults JSON</label>
          <textarea id="preset-defaults" name="preset-defaults" rows="12" spellcheck="false" .value=${t.draft.defaultsJson}
            @input=${e=>i(e.currentTarget.value)}></textarea>
        </details>
        <button type="button" data-save-preset @click=${()=>void t.save(e,n)}>${t.busy?`Saving…`:`Save preset`}</button>
        <button type="button" @click=${()=>r(()=>{t.open=!1,t.error=``})}>Cancel edit</button>
      </fieldset>
    </section>`:null}
  </section>`}function Rn(e,t){return D`<label class="theme-selector">
    <span>Theme</span>
    <select data-theme-selector aria-label="Theme" .value=${e}
      @change=${e=>t(e.currentTarget.value)}>
      ${Je.map(e=>D`
        <option value=${e.value}>${e.label}</option>
      `)}
    </select>
  </label>`}function Q(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a}var $=class extends N{constructor(...e){super(...e),this.view=`dashboard`,this.theme=Ze(),this.workflowId=``,this.tokens=new ze(Be(`taskflow-access-token`)),this.configuration={},this.store=null,this.live=null,this.loadGeneration=0,this.createState={packageIds:[],taskNames:[],taskJson:`{}`,workflowName:``,cleanupOnSuccess:!1},this.manuallyOrderedTasks=!1,this.presetEditor=new In,this.tmdbRecovery=new nn,this.dvdIsoRecovery=new ln,this.dvdWarningReview=new hn,this.introSkipReview=new yn,this.needsToken=!1,this.message=``,this.busy=!1,this.showUnavailable=!1}static{this.styles=[Ge,Ke]}configure(e){this.tokens.configure(e),this.configuration={...e},e.theme&&(this.theme=e.theme),this.needsToken=!1,this.requestUpdate(),this.hasUpdated&&this.load()}get api(){return new Re(this.configuration.apiUrl||Be(`taskflow-api-url`)||window.location.origin,this.tokens)}willUpdate(e){if((e.has(`view`)||e.has(`workflowId`))&&(this.tmdbRecovery.clear(),this.dvdIsoRecovery.clear(),this.dvdWarningReview.clear(),this.introSkipReview.clear()),e.has(`view`)&&(this.view===`create`||this.view===`presets`)&&this.store?.loadPresets(),this.store&&!this.store.loading){let e=new Set(this.store.selectablePackages.map(e=>e.id));this.createState.packageIds=this.createState.packageIds.filter(t=>e.has(t))}}async firstUpdated(){await this.load()}disconnectedCallback(){super.disconnectedCallback(),this.loadGeneration+=1,this.live?.close()}async load(){let e=++this.loadGeneration;try{this.live?.close();let t=this.api,n=new Ue(t);if(n.onChange=()=>this.requestUpdate(),await n.resync(),e!==this.loadGeneration||(this.store=n,(this.view===`create`||this.view===`presets`)&&n.loadPresets(),this.resetCreateState(),this.live=new Ve(t,n,t.baseUrl),this.live.onStateChange=()=>this.requestUpdate(),await this.live.connect(),e!==this.loadGeneration))return;this.needsToken=!1,this.message=`Connected`}catch(t){if(e!==this.loadGeneration)return;t instanceof Le&&t.status===401?(this.needsToken=!0,this.message=`Enter an access token`):this.message=t instanceof Error?t.message:`Unable to connect`}}async submitToken(e){e.preventDefault();let t=e.currentTarget.elements.namedItem(`access-token`);this.tokens.setManualToken(t.value),t.value=``,await this.load()}showWorkflow(e){this.workflowId=e,this.view=`workflow`}async showIntegration(e){if(this.store)try{await this.store.loadIntegrationDetail(e),this.view=`integrations`}catch(e){this.message=e instanceof Error?e.message:`Integration unavailable`}}changePackage(e,t){this.createState.packageIds=t?[...this.createState.packageIds,e]:this.createState.packageIds.filter(t=>t!==e),this.requestUpdate()}changeTheme(e){this.theme=e,Qe(e)}changePreset(e){let t=this.store?.presets.find(t=>t.code===e);if(e&&!t)return;let n=this.createState;t?this.createState=Xt(n,t):(this.resetCreateState(),this.createState.packageIds=n.packageIds,this.createState.workflowName=n.workflowName),this.manuallyOrderedTasks=!!t,this.requestUpdate()}changeTask(e,t){if(this.createState.tasksOverridden=!0,this.createState.presetCode){this.createState.taskNames=t?[...new Set([...this.createState.taskNames,e])]:this.createState.taskNames.filter(t=>t!==e),this.requestUpdate();return}this.createState.taskNames=Ft(this.createState.taskNames,e,t,this.manuallyOrderedTasks),this.createState.taskNames.length||(this.manuallyOrderedTasks=!1),this.requestUpdate()}moveTask(e,t){let n=[...this.createState.taskNames],r=n.indexOf(e),i=r+t;r<0||i<0||i>=n.length||([n[r],n[i]]=[n[i],n[r]],this.manuallyOrderedTasks=!0,this.createState.tasksOverridden=!0,this.createState.taskNames=n,this.requestUpdate())}recordWorkflow(e){this.store?.applyEvent({type:`workflow.updated`,data:e})}resetCreateState(){this.createState={packageIds:[],taskNames:Lt([],(this.store?.tasks??[]).filter(e=>e.name!==`extract_dvd_iso`),!0,!1),taskJson:`{}`,workflowName:``,cleanupOnSuccess:!1},this.manuallyOrderedTasks=!1}async submitWorkflow(){if(this.store&&!this.busy)try{let e=qt(this.createState.packageIds,this.createState.taskNames,this.createState.taskJson,this.createState.workflowName.trim()||this.store.packages.find(e=>e.id===this.createState.packageIds[0])?.display_name||this.createState.packageIds[0],this.createState.cleanupOnSuccess,this.createState);this.busy=!0,this.message=``;let t=await Jt(this.store.api,e,e=>{this.recordWorkflow(e),this.resetCreateState(),this.showWorkflow(e.id)});this.recordWorkflow(t.workflow),this.message=t.startError?`Workflow ${P(t.workflow)} (${t.workflow.id}) was created but could not start: ${t.startError.message}`:`Workflow ${P(t.workflow)} (${t.workflow.id}) started`,await this.store.resync()}catch(e){this.message=e instanceof Error?e.message:`Unable to create workflow`}finally{this.busy=!1}}async commandWorkflow(e){if(this.store&&!this.busy){this.busy=!0;try{this.recordWorkflow(await this.store.api.command(this.workflowId,e)),this.message=``,await this.store.resync()}catch(e){this.message=e instanceof Error?e.message:`Workflow command failed`}finally{this.busy=!1}}}async resumeWorkflow(e){if(this.store&&!this.busy){this.busy=!0;try{this.recordWorkflow(await this.store.api.resume(this.workflowId,e)),this.tmdbRecovery.clear(),this.dvdIsoRecovery.clear(),this.dvdWarningReview.clear(),this.introSkipReview.clear(),this.message=``,await this.store.resync()}catch(e){this.message=e instanceof Error?e.message:`Unable to resume workflow`}finally{this.busy=!1}}}async refreshIntegration(e){if(this.store&&!this.busy){this.busy=!0;try{await this.store.api.refreshIntegration(e),this.message=`Reconciliation requested`}catch(e){this.message=e instanceof Error?e.message:`Unable to request reconciliation`}finally{this.busy=!1}}}renderContent(){if(!this.store)return D`<p role="status">Loading current state…</p>`;if(this.view===`presets`)return Ln(this.store,this.presetEditor,()=>this.requestUpdate());if(this.view===`create`)return Yt(this.store,{...this.createState,busy:this.busy},{packageChanged:(e,t)=>this.changePackage(e,t),taskChanged:(e,t)=>this.changeTask(e,t),presetChanged:e=>this.changePreset(e),resetPreset:()=>this.changePreset(this.createState.presetCode||``),allTasksChanged:e=>{this.createState.tasksOverridden=!0,this.createState.taskNames=this.createState.presetCode?e?[...new Set([...this.createState.taskNames,...this.store.tasks.map(e=>e.name)])]:[]:Lt(this.createState.taskNames,this.store.tasks,e,this.manuallyOrderedTasks),e||(this.manuallyOrderedTasks=!1),this.requestUpdate()},moveTask:(e,t)=>this.moveTask(e,t),jsonChanged:e=>{this.createState.taskJson=e,this.requestUpdate()},nameChanged:e=>{this.createState.workflowName=e,this.requestUpdate()},cleanupChanged:e=>{this.createState.cleanupOnSuccess=e,this.createState.cleanupOverridden=!0,this.requestUpdate()},submit:()=>void this.submitWorkflow()});if(this.view===`packages`)return bt(this.store,e=>void this.showIntegration(e),this.showUnavailable);if(this.view===`integrations`)return xt(this.store,e=>void this.refreshIntegration(e),this.busy);if(this.view===`workflows`)return St(this.store,e=>this.showWorkflow(e),this.showUnavailable);if(this.view===`workflow`){let e=this.store.workflows.find(e=>e.id===this.workflowId);return D`${At(this.store,this.workflowId)}
        ${e?Pn(e,this.store.taskRuns.filter(t=>t.workflow_id===e.id),e=>void this.commandWorkflow(e),e=>void this.resumeWorkflow(e),e=>{this.message=e},this.store.packages.some(t=>t.workflow_id===e.id),{state:this.tmdbRecovery,dvdState:this.dvdIsoRecovery,warningState:this.dvdWarningReview,introSkipState:this.introSkipReview,changed:()=>this.requestUpdate(),busy:this.busy}):null}`}return nt(this.store,e=>this.showWorkflow(e))}render(){return D`<div class="app-shell"><header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">T</span><div>
        <strong>TaskFlow</strong><small>Operator console</small>
      </div></div>
      <div class="topbar-controls">
        ${Rn(this.theme,e=>this.changeTheme(e))}
        <div class="connection" role="status"><span class="connection-dot"></span>
          ${this.live?.connectionState||`disconnected`}
        </div>
      </div>
    </header><div class="layout">
      ${this.store&&!this.needsToken?D`<nav aria-label="Main navigation" class="sidebar">
        ${[`dashboard`,`packages`,`integrations`,`workflows`,`presets`,`create`].map(e=>D`
          <button type="button" aria-current=${this.view===e?`page`:`false`}
            @click=${()=>{this.view=e}}>${e[0].toUpperCase()+e.slice(1)}</button>
        `)}
        ${this.view===`workflow`?D`<button type="button" aria-current="page">Workflow detail</button>`:null}
        <label class="option-row"><input type="checkbox" .checked=${this.showUnavailable}
          @change=${e=>{this.showUnavailable=e.currentTarget.checked}}><span>Show unavailable</span></label>
      </nav>`:null}
      <main>
      ${this.message&&this.message!==`Connected`?D`<p role="status">${this.message}</p>`:null}
      ${this.needsToken?D`
        <section class="auth-panel"><h1>Connect to TaskFlow</h1>
        <p>Enter an access token to load current workflow state.</p>
        <form @submit=${this.submitToken}>
          <label for="access-token">Access token</label>
          <input id="access-token" name="access-token" type="password" required autocomplete="off">
          <button type="submit">Connect</button>
        </form></section>
      `:this.renderContent()}
      </main></div></div>`}};Q([Fe({reflect:!0})],$.prototype,`view`,void 0),Q([Fe({reflect:!0})],$.prototype,`theme`,void 0),Q([Fe({attribute:`workflow-id`})],$.prototype,`workflowId`,void 0),Q([Ie()],$.prototype,`needsToken`,void 0),Q([Ie()],$.prototype,`message`,void 0),Q([Ie()],$.prototype,`busy`,void 0),Q([Ie()],$.prototype,`showUnavailable`,void 0),customElements.get(`taskflow-ui`)||customElements.define(`taskflow-ui`,$);