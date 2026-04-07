fetch('data/family.json')
.then(res=>res.json())
.then(data=>{
const tree=document.getElementById('tree');
data.forEach(p=>{
const div=document.createElement('div');
div.className='card '+(p.status==='deceased'?'deceased':'');
div.innerHTML=`<img src="${p.img||''}"><h3>${p.name}</h3>
<p>${p.role}</p>
<p>DOB: ${p.dob||'-'}</p>
<p>POB: ${p.pob||'-'}</p>
${p.dod?`<p>DOD: ${p.dod}</p>`:''}`;
tree.appendChild(div);
});
});