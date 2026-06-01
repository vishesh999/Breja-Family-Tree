# Family Tree Builder - Streamlit App (Improved)
from __future__ import annotations

import json
import uuid
import html
import os
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Tuple, Optional, Set
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


# =========================
# Configuration
# =========================

PERSISTENCE_FILE = ".streamlit_family_tree.json"
SVG_NODE_WIDTH = 260
SVG_NODE_HEIGHT = 100
SVG_X_GAP = 340
SVG_Y_GAP = 160
SVG_PADDING = 60
SVG_TOGGLE_R = 10


# =========================
# Data Model (Biological: ≤2 parents)
# =========================

@dataclass
class Person:
    id: str
    name: str
    sex: Optional[str] = None  # "M", "F", or None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    mother_id: Optional[str] = None
    father_id: Optional[str] = None
    spouse_ids: Set[str] = field(default_factory=set)
    children_ids: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    image: Optional[str] = None

    def add_child(self, child_id: str) -> None:
        if child_id not in self.children_ids:
            self.children_ids.append(child_id)

    def add_spouse(self, spouse_id: str) -> None:
        if spouse_id != self.id:
            self.spouse_ids.add(spouse_id)

    def remove_child(self, child_id: str) -> None:
        if child_id in self.children_ids:
            self.children_ids.remove(child_id)


@dataclass
class FamilyTree:
    people: Dict[str, Person] = field(default_factory=dict)

    # ---- Validation ----
    def validate_dates(self, birth_year: Optional[int], death_year: Optional[int]) -> Tuple[bool, str]:
        """Validate birth and death years."""
        if birth_year is not None and death_year is not None:
            if death_year < birth_year:
                return False, "Death year cannot be before birth year"
        return True, ""

    def validate_parent_child_dates(self, parent_id: str, child_id: str) -> Tuple[bool, str]:
        """Validate that parent was born before child with reasonable age gap."""
        parent = self.people.get(parent_id)
        child = self.people.get(child_id)
        if parent and child:
            if parent.birth_year is not None and child.birth_year is not None:
                if parent.birth_year >= child.birth_year:
                    return False, f"Parent must be born before child"
                age_gap = child.birth_year - parent.birth_year
                if age_gap < 10:
                    return False, f"Parent should be at least 10 years older than child (only {age_gap} years apart)"
                if age_gap > 70:
                    return False, f"Unrealistic age gap: {age_gap} years. Check dates."
        return True, ""

    def has_circular_reference(self, parent_id: str, child_id: str) -> bool:
        """Check if making this parent-child link would create a circular reference."""
        visited = set()
        stack = [child_id]
        while stack:
            current = stack.pop()
            if current in visited:
                continue
            visited.add(current)
            if current == parent_id:
                return True
            person = self.people.get(current)
            if person:
                stack.extend(person.children_ids)
        return False

    # ---- Core links ----
    def link_parent_child(self, parent_id: str, child_id: str, parent_role: str) -> Tuple[bool, str]:
        """
        Link parent to child. parent_role in {'mother','father'}
        Returns (success, error_message)
        """
        if parent_id not in self.people or child_id not in self.people:
            return False, "Parent or child not found"
        
        if parent_id == child_id:
            return False, "Person cannot be their own parent"
        
        if self.has_circular_reference(parent_id, child_id):
            return False, "Cannot link: this would create a circular reference (descendant cannot be ancestor)"
        
        child = self.people[child_id]
        parent = self.people[parent_id]
        
        valid, msg = self.validate_parent_child_dates(parent_id, child_id)
        if not valid:
            return False, msg
        
        if parent_role == "mother" and parent.sex == "M":
            return False, "Cannot assign male as mother"
        if parent_role == "father" and parent.sex == "F":
            return False, "Cannot assign female as father"
        
        if parent_role == "mother" and child.mother_id is not None:
            if child.mother_id != parent_id:
                return False, f"Child already has mother: {self.people[child.mother_id].name}"
        if parent_role == "father" and child.father_id is not None:
            if child.father_id != parent_id:
                return False, f"Child already has father: {self.people[child.father_id].name}"
        
        if parent_role == "mother":
            child.mother_id = parent_id
            if parent.sex is None:
                parent.sex = "F"
        elif parent_role == "father":
            child.father_id = parent_id
            if parent.sex is None:
                parent.sex = "M"
        
        parent.add_child(child_id)
        return True, ""

    def unlink_parent_child(self, parent_id: str, child_id: str) -> Tuple[bool, str]:
        """Remove parent-child relationship."""
        if parent_id not in self.people or child_id not in self.people:
            return False, "Parent or child not found"
        
        child = self.people[child_id]
        parent = self.people[parent_id]
        
        if child.mother_id == parent_id:
            child.mother_id = None
        elif child.father_id == parent_id:
            child.father_id = None
        else:
            return False, "No parent-child relationship exists"
        
        parent.remove_child(child_id)
        return True, ""

    def link_spouses(self, a_id: str, b_id: str) -> Tuple[bool, str]:
        """Link two people as spouses."""
        if a_id not in self.people or b_id not in self.people:
            return False, "Person not found"
        if a_id == b_id:
            return False, "Person cannot be their own spouse"
        
        self.people[a_id].add_spouse(b_id)
        self.people[b_id].add_spouse(a_id)
        return True, ""

    def unlink_spouses(self, a_id: str, b_id: str) -> Tuple[bool, str]:
        """Remove spouse relationship."""
        if a_id not in self.people or b_id not in self.people:
            return False, "Person not found"
        
        self.people[a_id].spouse_ids.discard(b_id)
        self.people[b_id].spouse_ids.discard(a_id)
        return True, ""

    def link_existing_child(self, parent_id: str, child_id: str) -> Tuple[bool, str]:
        """Link an existing person as a child to a parent."""
        if parent_id not in self.people or child_id not in self.people:
            return False, "Person not found"
        
        parent = self.people[parent_id]
        if not parent.sex:
            return False, "Parent's sex must be set before linking children"
        
        role = "mother" if parent.sex == "F" else "father"
        return self.link_parent_child(parent_id, child_id, role)

    def delete_person(self, person_id: str) -> Tuple[bool, str]:
        """Delete a person and clean up all references."""
        if person_id not in self.people:
            return False, "Person not found"
        
        person = self.people[person_id]
        
        for child_id in person.children_ids:
            child = self.people.get(child_id)
            if child:
                if child.mother_id == person_id:
                    child.mother_id = None
                if child.father_id == person_id:
                    child.father_id = None
        
        for spouse_id in person.spouse_ids:
            spouse = self.people.get(spouse_id)
            if spouse and person_id in spouse.spouse_ids:
                spouse.spouse_ids.remove(person_id)
        
        if person.mother_id:
            mother = self.people.get(person.mother_id)
            if mother and person_id in mother.children_ids:
                mother.children_ids.remove(person_id)
        
        if person.father_id:
            father = self.people.get(person.father_id)
            if father and person_id in father.children_ids:
                father.children_ids.remove(person_id)
        
        del self.people[person_id]
        return True, ""

    # ---- Derived ----
    def roots(self) -> List[str]:
        """Persons without parents."""
        roots = [pid for pid, p in self.people.items() if not p.mother_id and not p.father_id]
        return sorted(roots, key=lambda i: self.people[i].name.lower()) if roots else sorted(self.people.keys(), key=lambda i: self.people[i].name.lower())

    def parents_of(self, person_id: str) -> List[str]:
        p = self.people.get(person_id)
        ids = []
        if p:
            if p.mother_id: ids.append(p.mother_id)
            if p.father_id: ids.append(p.father_id)
        return ids

    def siblings_of(self, person_id: str) -> List[str]:
        """Get siblings (share at least one parent)."""
        person = self.people.get(person_id)
        if not person:
            return []
        
        siblings = set()
        
        if person.mother_id:
            mother = self.people.get(person.mother_id)
            if mother:
                siblings.update(mother.children_ids)
        
        if person.father_id:
            father = self.people.get(person.father_id)
            if father:
                siblings.update(father.children_ids)
        
        siblings.discard(person_id)
        return sorted([sid for sid in siblings if sid in self.people], 
                     key=lambda i: self.people[i].name.lower())

    def get_available_parents(self, person_id: str) -> List[Tuple[str, str]]:
        """Get list of people who could be parents (born before person, not descendants)."""
        person = self.people.get(person_id)
        if not person:
            return []
        
        available = []
        for pid, p in self.people.items():
            if pid == person_id:
                continue
            if pid == person.mother_id or pid == person.father_id:
                continue
            if self.has_circular_reference(pid, person_id):
                continue
            if person.birth_year and p.birth_year:
                if p.birth_year >= person.birth_year - 10:
                    continue
            available.append((p.name, pid))
        
        return sorted(available, key=lambda x: x[0].lower())

    def get_available_children(self, person_id: str) -> List[Tuple[str, str]]:
        """Get list of people who could be children."""
        person = self.people.get(person_id)
        if not person:
            return []
        
        available = []
        for cid, c in self.people.items():
            if cid == person_id:
                continue
            if cid in person.children_ids:
                continue
            if self.has_circular_reference(person_id, cid):
                continue
            if person.birth_year and c.birth_year:
                if person.birth_year >= c.birth_year - 10:
                    continue
            available.append((c.name, cid))
        
        return sorted(available, key=lambda x: x[0].lower())

    def get_available_spouses(self, person_id: str) -> List[Tuple[str, str]]:
        """Get list of people who could be spouses."""
        person = self.people.get(person_id)
        if not person:
            return []
        
        available = []
        for sid, s in self.people.items():
            if sid == person_id:
                continue
            if sid in person.spouse_ids:
                continue
            if sid == person.mother_id or sid == person.father_id:
                continue
            if sid in person.children_ids:
                continue
            if sid in self.siblings_of(person_id):
                continue
            available.append((s.name, sid))
        
        return sorted(available, key=lambda x: x[0].lower())

    def grandparents_of(self, person_id: str) -> List[str]:
        gps = []
        for pid in self.parents_of(person_id):
            pp = self.people.get(pid)
            if pp:
                if pp.mother_id: gps.append(pp.mother_id)
                if pp.father_id: gps.append(pp.father_id)
        return [i for i in gps if i in self.people]

    def aunts_uncles_of(self, person_id: str) -> List[str]:
        """Parents' siblings."""
        au = set()
        p = self.people.get(person_id)
        if not p:
            return []
        for parent_id in [p.mother_id, p.father_id]:
            if not parent_id: continue
            parent = self.people.get(parent_id)
            if not parent: continue
            for gp_id in [parent.mother_id, parent.father_id]:
                gp = self.people.get(gp_id)
                if not gp: continue
                for child_id in gp.children_ids:
                    if child_id != parent_id:
                        au.add(child_id)
        return sorted([i for i in au if i in self.people])

    def cousins_of(self, person_id: str) -> List[str]:
        cousins = []
        for au_id in self.aunts_uncles_of(person_id):
            au = self.people.get(au_id)
            if au:
                cousins.extend(au.children_ids)
        return sorted([i for i in cousins if i in self.people])

    def generations_visible(self, collapsed: Set[str]) -> Dict[int, List[str]]:
        """BFS from roots; hide descendants of collapsed nodes."""
        if not self.people:
            return {}
        queue: List[Tuple[str, int]] = [(rid, 0) for rid in self.roots()]
        seen: Set[str] = set()
        levels: Dict[int, List[str]] = {}

        while queue:
            pid, lvl = queue.pop(0)
            if pid in seen:
                continue
            seen.add(pid)
            levels.setdefault(lvl, []).append(pid)

            if pid in collapsed:
                continue

            p = self.people.get(pid)
            if not p:
                continue
            for cid in p.children_ids:
                if cid in self.people:
                    queue.append((cid, lvl + 1))

        ordered = {}
        for new_idx, lvl in enumerate(sorted(levels.keys())):
            ordered[new_idx] = levels[lvl]
        return ordered

    def subtree_size(self, person_id: str) -> int:
        count = 0
        stack = list(self.people.get(person_id, Person("", "")).children_ids)
        seen = set()
        while stack:
            cid = stack.pop()
            if cid in seen:
                continue
            seen.add(cid)
            if cid in self.people:
                count += 1
                stack.extend(self.people[cid].children_ids)
        return count


# =========================
# Persistence (File-based)
# =========================

def tree_to_json(ft: FamilyTree) -> str:
    """Serialize tree to JSON string."""
    def person_to_dict(p: Person) -> dict:
        d = asdict(p)
        d["spouse_ids"] = list(p.spouse_ids)
        return d
    data = {"people": {pid: person_to_dict(p) for pid, p in ft.people.items()}}
    return json.dumps(data, indent=2)


def json_to_tree(json_str: str) -> FamilyTree:
    """Deserialize tree from JSON string."""
    try:
        data = json.loads(json_str)
        tree = FamilyTree()
        for pid, pdata in data.get("people", {}).items():
            tree.people[pid] = Person(
                id=pdata["id"],
                name=pdata["name"],
                sex=pdata.get("sex"),
                birth_year=pdata.get("birth_year"),
                death_year=pdata.get("death_year"),
                mother_id=pdata.get("mother_id"),
                father_id=pdata.get("father_id"),
                spouse_ids=set(pdata.get("spouse_ids", [])),
                children_ids=pdata.get("children_ids", []),
                notes=pdata.get("notes"),
                image=pdata.get("image"),
            )
        return tree
    except Exception as e:
        st.error(f"Error loading tree: {e}")
        return FamilyTree()


def load_tree_from_file(filepath: str = PERSISTENCE_FILE) -> FamilyTree:
    """Load tree from local file."""
    if os.path.exists(filepath):
        try:
            with open(filepath, "r") as f:
                return json_to_tree(f.read())
        except Exception as e:
            st.warning(f"Could not load saved tree: {e}")
            return FamilyTree()
    return FamilyTree()


def save_tree_to_file(ft: FamilyTree, filepath: str = PERSISTENCE_FILE) -> bool:
    """Save tree to local file."""
    try:
        with open(filepath, "w") as f:
            f.write(tree_to_json(ft))
        return True
    except Exception as e:
        st.error(f"Error saving tree: {e}")
        return False


# =========================
# Utilities
# =========================

def xml(s: Optional[object]) -> str:
    """Safely escape strings for HTML/SVG."""
    return html.escape("" if s is None else str(s), quote=True)


def person_options(tree: FamilyTree) -> List[Tuple[str, str]]:
    """Get sorted list of (name, id) tuples for selectbox."""
    return sorted([(p.name, pid) for pid, p in tree.people.items()], 
                  key=lambda x: x[0].lower())


def get_person_id_by_name(tree: FamilyTree, name: str) -> Optional[str]:
    """Find person ID by name."""
    for pid, p in tree.people.items():
        if p.name == name:
            return pid
    return None


# =========================
# SVG Renderer (Responsive)
# =========================

def render_tree(ft: FamilyTree, collapsed: Set[str], selected_id: Optional[str] = None) -> None:
    """Render family tree as SVG with responsive styling."""
    people = ft.people
    if not people:
        st.info("Add your first person to begin building the tree.")
        return

    raw_levels = ft.generations_visible(collapsed)
    if not raw_levels:
        st.info("No generations to render yet.")
        return

    level_rows: Dict[int, List[List[str]]] = {}

    def build_couple_rows(ids: List[str]) -> List[List[str]]:
        used = set()
        rows: List[List[str]] = []
        for pid in ids:
            if pid in used: continue
            p = people[pid]
            spouse_here = None
            for sid in p.spouse_ids:
                if sid in ids and sid not in used:
                    spouse_here = sid
                    break
            if spouse_here:
                rows.append([pid, spouse_here])
                used.add(pid); used.add(spouse_here)
            else:
                rows.append([pid])
                used.add(pid)
        rows.sort(key=lambda grp: people[grp[0]].name.lower())
        return rows

    def build_child_group_rows(ids: List[str]) -> List[List[str]]:
        groups: Dict[Tuple[str, str], List[str]] = {}
        orphans: List[str] = []
        for cid in ids:
            c = people[cid]
            key = (c.mother_id or "", c.father_id or "")
            if not c.mother_id and not c.father_id:
                orphans.append(cid)
            else:
                groups.setdefault(key, []).append(cid)

        def parent_names(key: Tuple[str, str]) -> Tuple[str, str]:
            m = people.get(key[0]); f = people.get(key[1])
            mn = m.name.lower() if m else ""
            fn = f.name.lower() if f else ""
            return (mn, fn)

        ordered_groups = sorted(groups.items(), key=lambda kv: parent_names(kv[0]))
        rows: List[List[str]] = []
        for _, child_ids in ordered_groups:
            for cid in sorted(child_ids, key=lambda i: people[i].name.lower()):
                rows.append([cid])

        for oid in sorted(orphans, key=lambda i: people[i].name.lower()):
            rows.append([oid])

        return rows

    for lvl, ids in raw_levels.items():
        if lvl == 0:
            level_rows[lvl] = build_couple_rows(ids)
        else:
            level_rows[lvl] = build_child_group_rows(ids)

    node_w, node_h = SVG_NODE_WIDTH, SVG_NODE_HEIGHT
    x_gap, y_gap = SVG_X_GAP, SVG_Y_GAP
    padding = SVG_PADDING
    toggle_r = SVG_TOGGLE_R

    pos: Dict[str, Tuple[int, int]] = {}
    max_cols = len(level_rows)
    max_rows = max((len(rows) for rows in level_rows.values()), default=1)

    for lvl in sorted(level_rows.keys()):
        rows = level_rows[lvl]
        for row_idx, entry in enumerate(rows):
            base_x = padding + lvl * x_gap
            base_y = padding + row_idx * y_gap
            if len(entry) == 2:
                a_id, b_id = entry
                pos[a_id] = (base_x, base_y)
                pos[b_id] = (base_x + node_w + 20, base_y)
            else:
                pid = entry[0]
                pos[pid] = (base_x, base_y)

    width = padding * 2 + max(0, (max_cols - 1)) * x_gap + node_w * 2 + 20
    height = max(padding * 2 + max(0, (max_rows - 1)) * y_gap + node_h, 400)

    def node_svg(p: Person, x: int, y: int, is_selected: bool = False) -> str:
        """Generate SVG for a person node."""
        tx = x + 18
        ty = y + 34

        name = xml(p.name) or "—"
        rel_line = ("Male" if p.sex == "M" else ("Female" if p.sex == "F" else ""))
        dates = []
        if p.birth_year is not None: dates.append(f"Birth: {xml(p.birth_year)}")
        if p.death_year is not None: dates.append(f"Death: {xml(p.death_year)}")
        date_line = " • ".join(dates)

        has_children = len(p.children_ids) > 0
        collapsed_here = p.id in collapsed
        toggle = ""
        if has_children:
            hidden_count = ft.subtree_size(p.id) if collapsed_here else 0
            sign = "+" if collapsed_here else "−"
            badge = f"{sign}{hidden_count if collapsed_here and hidden_count>0 else ''}"
            t_cx = x + node_w - 16
            t_cy = y + 18
            toggle = f"""
            <a href="?toggle={xml(p.id)}">
              <circle cx="{t_cx}" cy="{t_cy}" r="{toggle_r}"
                      fill="#f1f4fb" stroke="rgba(28,39,60,0.25)" stroke-width="1" />
              <text x="{t_cx}" y="{t_cy+4}" text-anchor="middle"
                    font-size="12" font-weight="800" fill="#2b2f38">{xml(badge)}</text>
            </a>
            """

        # Highlight selected person
        stroke_color = "rgba(59, 130, 246, 0.8)" if is_selected else "rgba(28,39,60,0.12)"
        stroke_width = "3" if is_selected else "1"

        return f"""
        <g>
          <rect x="{x}" y="{y}" width="{node_w}" height="{node_h}"
                rx="12" ry="12" fill="#ffffff"
                stroke="{stroke_color}" stroke-width="{stroke_width}" />
          {toggle}
          <text x="{tx}" y="{ty}" font-size="15" font-weight="700" fill="#2b2f38">{name}</text>
          {f'<text x="{tx}" y="{ty+20}" font-size="12" fill="#455065">{xml(rel_line)}</text>' if rel_line else ""}
          {f'<text x="{tx}" y="{ty+40}" font-size="12" fill="#6b7382">{xml(date_line)}</text>' if date_line else ""}
        </g>
        """

    marriage_lines: List[str] = []
    for lvl, rows in level_rows.items():
        for entry in rows:
            if len(entry) == 2:
                a_id, b_id = entry
                if a_id in pos and b_id in pos:
                    ax, ay = pos[a_id]
                    bx, by = pos[b_id]
                    y_center = ay + node_h / 2
                    x_a_right = ax + node_w
                    x_b_left = bx
                    marriage_lines.append(
                        f'<path d="M {x_a_right} {y_center} H {x_b_left}" fill="none" stroke="rgba(28,39,60,0.35)" stroke-width="2" />'
                    )

    edges: List[str] = []
    for cid, child in people.items():
        child_pos = pos.get(cid)
        if not child_pos:
            continue
        end_x, end_y = child_pos[0], child_pos[1] + node_h / 2

        parent_ids = []
        if child.mother_id and child.mother_id in pos: parent_ids.append(child.mother_id)
        if child.father_id and child.father_id in pos: parent_ids.append(child.father_id)

        if len(parent_ids) == 2:
            m_id, f_id = parent_ids
            mx, my = pos[m_id]; fx, fy = pos[f_id]
            start_x = (mx + node_w + fx) / 2.0
            path = f"M {start_x} {my + node_h/2} V {end_y} H {end_x}"
            edges.append(f'<path d="{path}" fill="none" stroke="rgba(28,39,60,0.25)" stroke-width="2" />')
        elif len(parent_ids) == 1:
            p_id = parent_ids[0]
            px, py = pos[p_id]
            start_x = px + node_w / 2
            path = f"M {start_x} {py + node_h} V {end_y} H {end_x}"
            edges.append(f'<path d="{path}" fill="none" stroke="rgba(28,39,60,0.25)" stroke-width="2" />')

    nodes_svg = "".join(
        node_svg(people[mid], *pos[mid], is_selected=(mid == selected_id)) 
        for mid in pos
    )

    container_css = """
    <style>
      .svg-wrap {
        width: 100%;
        overflow: auto;
        border-radius: 12px;
        border: 1px solid rgba(28,39,60,0.08);
        background: #fff;
      }
      .svg-wrap svg { display: block; }
      .svg-wrap a { text-decoration: none; }
      @media (max-width: 768px) {
        .svg-wrap svg { transform: scale(0.8); transform-origin: top left; }
      }
    </style>
    """

    html_doc = f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {container_css}
      </head>
      <body>
        <div class="svg-wrap">
          <svg width="{width}" height="{height}" viewBox="0 0 {width} {height}"
               xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="{width}" height="{height}" fill="#ffffff" rx="12" ry="12"/>
            {''.join(marriage_lines)}
            {''.join(edges)}
            {nodes_svg}
          </svg>
        </div>
      </body>
    </html>
    """
    components.html(html_doc, height=int(height + 60), scrolling=True)


# =========================
# App State & Persistence
# =========================

def ensure_state() -> None:
    """Initialize state and load from persistent storage."""
    if "tree" not in st.session_state:
        st.session_state.tree = load_tree_from_file()
    
    if "collapsed" not in st.session_state:
        st.session_state.collapsed = set()
    if "selected_id" not in st.session_state:
        st.session_state.selected_id = None
    if "delete_confirm" not in st.session_state:
        st.session_state.delete_confirm = None


def save_tree() -> None:
    """Save tree to local file."""
    save_tree_to_file(st.session_state.tree)


# =========================
# Form Helpers (Consolidated)
# =========================

def person_form(
    title: str,
    name_key: str,
    sex_key: str,
    birth_key: str,
    death_key: str,
    notes_key: str = None,
    image_key: str = None,
    clear_on_submit: bool = True
) -> Dict[str, any]:
    """Reusable person form component."""
    with st.form(f"person_form_{name_key}", clear_on_submit=clear_on_submit):
        st.markdown(f"**{title}**")
        name = st.text_input("Name*", key=name_key, placeholder="e.g., John Doe")
        sex = st.selectbox("Sex", ["—", "M", "F"], index=0, key=sex_key)
        
        col1, col2 = st.columns(2)
        with col1:
            birth_year = st.number_input("Birth year", min_value=0, max_value=3000, step=1, value=0, key=birth_key)
        with col2:
            death_year = st.number_input("Death year", min_value=0, max_value=3000, step=1, value=0, key=death_key)
        
        notes = ""
        image = ""
        if notes_key:
            notes = st.text_area("Notes", key=notes_key, height=80)
        if image_key:
            image = st.text_input("Image path", key=image_key, placeholder="e.g., img/photo.jpg")
        
        submitted = st.form_submit_button("Submit", type="primary")
        
        return {
            "submitted": submitted,
            "name": name.strip(),
            "sex": None if sex == "—" else sex,
            "birth_year": None if birth_year == 0 else int(birth_year),
            "death_year": None if death_year == 0 else int(death_year),
            "notes": notes if notes else None,
            "image": image if image else None,
        }


# =========================
# UI Sections
# =========================

def add_person_section() -> None:
    """Add a new person to the tree."""
    st.subheader("➕ Add New Person")
    result = person_form(
        "Add Person",
        "add_name", "add_sex", "add_birth", "add_death",
        "add_notes", "add_image"
    )
    
    if result["submitted"]:
        if not result["name"]:
            st.warning("⚠️ Name is required.")
            return
        
        valid, msg = st.session_state.tree.validate_dates(result["birth_year"], result["death_year"])
        if not valid:
            st.error(f"❌ {msg}")
            return
        
        pid = uuid.uuid4().hex[:12]
        st.session_state.tree.people[pid] = Person(
            id=pid,
            name=result["name"],
            sex=result["sex"],
            birth_year=result["birth_year"],
            death_year=result["death_year"],
            notes=result["notes"],
            image=result["image"],
        )
        st.session_state.selected_id = pid
        save_tree()
        st.success(f"✅ Added {result['name']} to the family tree!")
        st.rerun()


def link_existing_section() -> None:
    """Link existing people together."""
    st.subheader("🔗 Link Existing People")
    people = st.session_state.tree.people
    if len(people) < 2:
        st.info("ℹ️ Add at least 2 people to create links.")
        return
    
    tab1, tab2, tab3, tab4 = st.tabs(["👪 Parent-Child", "💑 Spouses", "👨‍👩‍👧 Quick Family", "✂️ Unlink"])
    
    with tab1:
        st.markdown("**Link existing person as parent or child**")
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("*Link as Parent*")
            with st.form("link_parent"):
                options = person_options(st.session_state.tree)
                parent_name = st.selectbox("Select Parent", [n for n, _ in options], key="parent_sel")
                parent_id = get_person_id_by_name(st.session_state.tree, parent_name)
                
                if parent_id:
                    available_children = st.session_state.tree.get_available_children(parent_id)
                    if available_children:
                        child_name = st.selectbox("Select Child", [n for n, _ in available_children])
                        child_id = get_person_id_by_name(st.session_state.tree, child_name)
                        
                        if st.form_submit_button("Link Parent → Child", type="primary"):
                            success, error = st.session_state.tree.link_existing_child(parent_id, child_id)
                            if success:
                                save_tree()
                                st.success(f"✅ Linked {parent_name} as parent of {child_name}!")
                                st.rerun()
                            else:
                                st.error(f"❌ {error}")
                    else:
                        st.info("No valid children available for this person")
        
        with col2:
            st.markdown("*Link as Child*")
            with st.form("link_child"):
                options = person_options(st.session_state.tree)
                child_name = st.selectbox("Select Child", [n for n, _ in options], key="child_sel")
                child_id = get_person_id_by_name(st.session_state.tree, child_name)
                
                if child_id:
                    available_parents = st.session_state.tree.get_available_parents(child_id)
                    if available_parents:
                        parent_name = st.selectbox("Select Parent", [n for n, _ in available_parents])
                        parent_id = get_person_id_by_name(st.session_state.tree, parent_name)
                        
                        if st.form_submit_button("Link Child → Parent", type="primary"):
                            success, error = st.session_state.tree.link_existing_child(parent_id, child_id)
                            if success:
                                save_tree()
                                st.success(f"✅ Linked {child_name} as child of {parent_name}!")
                                st.rerun()
                            else:
                                st.error(f"❌ {error}")
                    else:
                        st.info("No valid parents available for this person")
    
    with tab2:
        st.markdown("**Link two people as spouses**")
        with st.form("link_spouses"):
            options = person_options(st.session_state.tree)
            person1_name = st.selectbox("First Person", [n for n, _ in options], key="sp1")
            person1_id = get_person_id_by_name(st.session_state.tree, person1_name)
            
            if person1_id:
                available_spouses = st.session_state.tree.get_available_spouses(person1_id)
                if available_spouses:
                    person2_name = st.selectbox("Second Person", [n for n, _ in available_spouses])
                    person2_id = get_person_id_by_name(st.session_state.tree, person2_name)
                    
                    if st.form_submit_button("Link as Spouses", type="primary"):
                        success, error = st.session_state.tree.link_spouses(person1_id, person2_id)
                        if success:
                            save_tree()
                            st.success(f"✅ Linked {person1_name} and {person2_name} as spouses!")
                            st.rerun()
                        else:
                            st.error(f"❌ {error}")
                else:
                    st.info("No valid spouse candidates available")
    
    with tab3:
        st.markdown("**Quick add: Parent + Child + connect to existing family**")
        with st.form("quick_family"):
            base_person_name = st.selectbox("Connect to existing person", [p.name for _, p in sorted(people.items(), key=lambda kv: kv[1].name.lower())])
            base_id = get_person_id_by_name(st.session_state.tree, base_person_name)
            
            new_parent_name = st.text_input("New Parent Name")
            new_parent_sex = st.selectbox("Parent Sex", ["M", "F"])
            new_child_name = st.text_input("New Child Name")
            new_child_sex = st.selectbox("Child Sex", ["—", "M", "F"], index=0)
            
            if st.form_submit_button("Create Family Unit", type="primary"):
                if not new_parent_name or not new_child_name:
                    st.warning("⚠️ Both names are required")
                elif not base_id:
                    st.error("❌ Base person not found")
                else:
                    parent_id = uuid.uuid4().hex[:12]
                    st.session_state.tree.people[parent_id] = Person(
                        id=parent_id, name=new_parent_name.strip(), sex=new_parent_sex
                    )
                    
                    st.session_state.tree.link_spouses(base_id, parent_id)
                    
                    child_id = uuid.uuid4().hex[:12]
                    st.session_state.tree.people[child_id] = Person(
                        id=child_id, name=new_child_name.strip(),
                        sex=(None if new_child_sex == "—" else new_child_sex)
                    )
                    
                    base_person = people[base_id]
                    if base_person.sex:
                        base_role = "father" if base_person.sex == "M" else "mother"
                        parent_role = "mother" if new_parent_sex == "F" else "father"
                        
                        st.session_state.tree.link_parent_child(base_id, child_id, base_role)
                        st.session_state.tree.link_parent_child(parent_id, child_id, parent_role)
                        
                        save_tree()
                        st.success(f"✅ Created family unit!")
                        st.rerun()
                    else:
                        st.error("❌ Base person needs sex defined first")
    
    with tab4:
        st.markdown("**Remove relationships**")
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("*Unlink Parent-Child*")
            with st.form("unlink_pc"):
                options = person_options(st.session_state.tree)
                child_name = st.selectbox("Child", [n for n, _ in options], key="unlink_child")
                child_id = get_person_id_by_name(st.session_state.tree, child_name)
                
                if child_id:
                    child_obj = people[child_id]
                    parent_options = []
                    if child_obj.mother_id:
                        parent_options.append((people[child_obj.mother_id].name, child_obj.mother_id))
                    if child_obj.father_id:
                        parent_options.append((people[child_obj.father_id].name, child_obj.father_id))
                    
                    if parent_options:
                        parent_name = st.selectbox("Parent to unlink", [n for n, _ in parent_options])
                        parent_id = get_person_id_by_name(st.session_state.tree, parent_name)
                        
                        if st.form_submit_button("Unlink", type="secondary"):
                            success, error = st.session_state.tree.unlink_parent_child(parent_id, child_id)
                            if success:
                                save_tree()
                                st.success(f"✅ Unlinked relationship!")
                                st.rerun()
                            else:
                                st.error(f"❌ {error}")
                    else:
                        st.info("This person has no parents linked")
        
        with col2:
            st.markdown("*Unlink Spouses*")
            with st.form("unlink_sp"):
                person_name = st.selectbox("Person", [n for n, _ in options], key="unlink_person")
                person_id = get_person_id_by_name(st.session_state.tree, person_name)
                
                if person_id:
                    person_obj = people[person_id]
                    if person_obj.spouse_ids:
                        spouse_options = [(people[sid].name, sid) for sid in person_obj.spouse_ids if sid in people]
                        if spouse_options:
                            spouse_name = st.selectbox("Spouse to unlink", [n for n, _ in spouse_options])
                            spouse_id = get_person_id_by_name(st.session_state.tree, spouse_name)
                            
                            if st.form_submit_button("Unlink", type="secondary"):
                                success, error = st.session_state.tree.unlink_spouses(person_id, spouse_id)
                                if success:
                                    save_tree()
                                    st.success(f"✅ Unlinked spouses!")
                                    st.rerun()
                                else:
                                    st.error(f"❌ {error}")
                    else:
                        st.info("This person has no spouses linked")


def quick_add_section() -> None:
    """Quick add new people with relationships."""
    st.subheader("⚡ Quick Add (Create + Link)")
    people = st.session_state.tree.people
    
    if not people:
        st.info("ℹ️ Add your first person above to begin.")
        return
    
    options = person_options(st.session_state.tree)
    names = [n for n, _ in options]
    default_idx = 0
    if st.session_state.selected_id and st.session_state.selected_id in people:
        selected_name = people[st.session_state.selected_id].name
        if selected_name in names:
            default_idx = names.index(selected_name)
    
    selected_name = st.selectbox("Working with:", names, index=default_idx, key="quick_person_selector")
    selected_id = get_person_id_by_name(st.session_state.tree, selected_name)
    st.session_state.selected_id = selected_id
    sel = people[selected_id]
    
    sex_icon = "👨" if sel.sex == "M" else ("👩" if sel.sex == "F" else "👤")
    st.info(f"{sex_icon} **{sel.name}** • {sel.sex or 'Sex not set'} • Born: {sel.birth_year or '?'}")
    
    if sel.notes:
        st.caption(f"📝 {sel.notes}")
    
    tab1, tab2, tab3, tab4 = st.tabs(["👨‍👩 Parents", "💑 Spouse", "👶 Children", "👫 Siblings"])
    
    with tab1:
        c1, c2 = st.columns(2)
        with c1:
            result = person_form(
                "Add Mother",
                "qm_name", "qm_sex", "qm_birth", "qm_death",
                "qm_notes", "qm_image",
                clear_on_submit=True
            )
            if result["submitted"]:
                if not result["name"]:
                    st.warning("⚠️ Name required")
                elif sel.mother_id:
                    st.warning(f"Already has mother: {people[sel.mother_id].name}")
                else:
                    valid, msg = st.session_state.tree.validate_dates(result["birth_year"], result["death_year"])
                    if not valid:
                        st.error(f"❌ {msg}")
                    else:
                        pid = uuid.uuid4().hex[:12]
                        st.session_state.tree.people[pid] = Person(
                            id=pid, name=result["name"], sex="F",
                            birth_year=result["birth_year"], death_year=result["death_year"],
                            notes=result["notes"], image=result["image"]
                        )
                        success, error = st.session_state.tree.link_parent_child(pid, selected_id, "mother")
                        if success:
                            save_tree()
                            st.success(f"✅ Added mother: {result['name']}")
                            st.rerun()
                        else:
                            del st.session_state.tree.people[pid]
                            st.error(f"❌ {error}")
        
        with c2:
            result = person_form(
                "Add Father",
                "qf_name", "qf_sex", "qf_birth", "qf_death",
                "qf_notes", "qf_image",
                clear_on_submit=True
            )
            if result["submitted"]:
                if not result["name"]:
                    st.warning("⚠️ Name required")
                elif sel.father_id:
                    st.warning(f"Already has father: {people[sel.father_id].name}")
                else:
                    valid, msg = st.session_state.tree.validate_dates(result["birth_year"], result["death_year"])
                    if not valid:
                        st.error(f"❌ {msg}")
                    else:
                        pid = uuid.uuid4().hex[:12]
                        st.session_state.tree.people[pid] = Person(
                            id=pid, name=result["name"], sex="M",
                            birth_year=result["birth_year"], death_year=result["death_year"],
                            notes=result["notes"], image=result["image"]
                        )
                        success, error = st.session_state.tree.link_parent_child(pid, selected_id, "father")
                        if success:
                            save_tree()
                            st.success(f"✅ Added father: {result['name']}")
                            st.rerun()
                        else:
                            del st.session_state.tree.people[pid]
                            st.error(f"❌ {error}")
    
    with tab2:
        result = person_form(
            "Add Spouse",
            "qs_name", "qs_sex", "qs_birth", "qs_death",
            "qs_notes", "qs_image",
            clear_on_submit=True
        )
        if result["submitted"]:
            if not result["name"]:
                st.warning("⚠️ Name required")
            else:
                valid, msg = st.session_state.tree.validate_dates(result["birth_year"], result["death_year"])
                if not valid:
                    st.error(f"❌ {msg}")
                else:
                    sid = uuid.uuid4().hex[:12]
                    st.session_state.tree.people[sid] = Person(
                        id=sid, name=result["name"],
                        sex=result["sex"],
                        birth_year=result["birth_year"], death_year=result["death_year"],
                        notes=result["notes"], image=result["image"]
                    )
                    success, error = st.session_state.tree.link_spouses(selected_id, sid)
                    if success:
                        save_tree()
                        st.success(f"✅ Added spouse: {result['name']}")
                        st.rerun()
                    else:
                        del st.session_state.tree.people[sid]
                        st.error(f"❌ {error}")
    
    with tab3:
        result = person_form(
            "Add Child",
            "qc_name", "qc_sex", "qc_birth", "qc_death",
            "qc_notes", "qc_image",
            clear_on_submit=True
        )
        if result["submitted"]:
            if not result["name"]:
                st.warning("⚠️ Name required")
            elif not sel.sex:
                st.error("❌ Set the selected person's sex first")
            else:
                valid, msg = st.session_state.tree.validate_dates(result["birth_year"], result["death_year"])
                if not valid:
                    st.error(f"❌ {msg}")
                else:
                    cid = uuid.uuid4().hex[:12]
                    st.session_state.tree.people[cid] = Person(
                        id=cid, name=result["name"],
                        sex=result["sex"],
                        birth_year=result["birth_year"], death_year=result["death_year"],
                        notes=result["notes"], image=result["image"]
                    )
                    role = "father" if sel.sex == "M" else "mother"
                    success, error = st.session_state.tree.link_parent_child(selected_id, cid, role)
                    if success:
                        save_tree()
                        st.success(f"✅ Added child: {result['name']}")
                        st.rerun()
                    else:
                        del st.session_state.tree.people[cid]
                        st.error(f"❌ {error}")
    
    with tab4:
        result = person_form(
            "Add Sibling",
            "qsib_name", "qsib_sex", "qsib_birth", "qsib_death",
            "qsib_notes", "qsib_image",
            clear_on_submit=True
        )
        if result["submitted"]:
            if not result["name"]:
                st.warning("⚠️ Name required")
            elif not sel.mother_id and not sel.father_id:
                st.error("❌ Add at least one parent first")
            else:
                valid, msg = st.session_state.tree.validate_dates(result["birth_year"], result["death_year"])
                if not valid:
                    st.error(f"❌ {msg}")
                else:
                    sid = uuid.uuid4().hex[:12]
                    st.session_state.tree.people[sid] = Person(
                        id=sid, name=result["name"],
                        sex=result["sex"],
                        birth_year=result["birth_year"], death_year=result["death_year"],
                        notes=result["notes"], image=result["image"]
                    )
                    errors = []
                    if sel.mother_id:
                        success, error = st.session_state.tree.link_parent_child(sel.mother_id, sid, "mother")
                        if not success:
                            errors.append(error)
                    if sel.father_id:
                        success, error = st.session_state.tree.link_parent_child(sel.father_id, sid, "father")
                        if not success:
                            errors.append(error)
                    
                    if errors:
                        del st.session_state.tree.people[sid]
                        st.error(f"❌ {' | '.join(errors)}")
                    else:
                        save_tree()
                        st.success(f"✅ Added sibling: {result['name']}")
                        st.rerun()
    
    with st.expander("📊 Current Relationships"):
        parents = st.session_state.tree.parents_of(selected_id)
        gps = st.session_state.tree.grandparents_of(selected_id)
        sibs = st.session_state.tree.siblings_of(selected_id)
        fmt = lambda ids: ", ".join(st.session_state.tree.people[i].name for i in ids) if ids else "None"
        st.write("**Parents:**", fmt(parents))
        st.write("**Grandparents:**", fmt(gps))
        st.write("**Siblings:**", fmt(sibs))
        st.write("**Spouses:**", fmt(list(sel.spouse_ids)))
        st.write("**Children:**", fmt(sel.children_ids))


def tree_section() -> None:
    """Render family tree visualization and controls."""
    st.subheader("🌳 Family Tree Visualization")
    render_tree(st.session_state.tree, st.session_state.collapsed, st.session_state.selected_id)
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if st.session_state.tree.people:
            json_str = tree_to_json(st.session_state.tree)
            st.download_button(
                "💾 Export JSON", 
                data=json_str, 
                file_name="family_tree.json", 
                mime="application/json"
            )
    
    with col2:
        uploaded_file = st.file_uploader("📤 Import JSON", type=['json'], key="upload_tree")
        if uploaded_file:
            try:
                content = uploaded_file.read().decode('utf-8')
                st.session_state.tree = json_to_tree(content)
                st.session_state.collapsed = set()
                st.session_state.selected_id = None
                save_tree()
                st.success("✅ Tree loaded!")
                st.rerun()
            except Exception as e:
                st.error(f"❌ Error: {e}")
    
    with col3:
        if st.button("🗑️ Clear All", type="secondary"):
            if st.session_state.tree.people:
                st.session_state.tree = FamilyTree()
                st.session_state.collapsed = set()
                st.session_state.selected_id = None
                save_tree()
                st.rerun()
    
    with col4:
        if st.session_state.selected_id and st.session_state.selected_id in st.session_state.tree.people:
            person_name = st.session_state.tree.people[st.session_state.selected_id].name
            if st.button(f"🗑️ Delete {person_name}", type="secondary", key="del_btn"):
                st.session_state.delete_confirm = st.session_state.selected_id
            
            if st.session_state.delete_confirm == st.session_state.selected_id:
                st.warning(f"⚠️ Delete **{person_name}**? This cannot be undone.")
                col_yes, col_no = st.columns(2)
                with col_yes:
                    if st.button("✅ Yes, delete", type="primary"):
                        success, error = st.session_state.tree.delete_person(st.session_state.selected_id)
                        if success:
                            st.session_state.selected_id = None
                            st.session_state.delete_confirm = None
                            save_tree()
                            st.success(f"✅ Deleted {person_name}")
                            st.rerun()
                        else:
                            st.error(f"❌ {error}")
                with col_no:
                    if st.button("❌ Cancel"):
                        st.session_state.delete_confirm = None
                        st.rerun()


# =========================
# Sidebar
# =========================

def render_sidebar() -> None:
    """Render sidebar with people list and search."""
    with st.sidebar:
        st.header("👥 People & Search")
        
        search_term = st.text_input("🔍 Search by name", placeholder="Type a name...")
        
        if st.session_state.tree.people:
            all_people = sorted(
                st.session_state.tree.people.items(),
                key=lambda kv: kv[1].name.lower()
            )
            
            if search_term:
                filtered = [
                    (pid, p) for pid, p in all_people
                    if search_term.lower() in p.name.lower()
                ]
            else:
                filtered = all_people
            
            if filtered:
                for pid, p in filtered:
                    flag = " 📦" if pid in st.session_state.collapsed else ""
                    selected_flag = " 👈" if pid == st.session_state.selected_id else ""
                    sex_icon = "👨" if p.sex == "M" else ("👩" if p.sex == "F" else "👤")
                    
                    # Clickable person indicator
                    if st.button(f"{sex_icon} {p.name}{flag}{selected_flag}", key=f"sidebar_person_{pid}"):
                        st.session_state.selected_id = pid
                        st.rerun()
            else:
                st.info("No matches found.")
            
            st.caption(f"**Total:** {len(st.session_state.tree.people)} people")
        else:
            st.info("No people added yet")
        
        st.divider()
        st.caption("**💡 Tips:**")
        st.caption("• Click person names to select")
        st.caption("• Use search to find people quickly")
        st.caption("• Quick Add for faster entry")
        st.caption("• Delete requires confirmation")
        st.caption("• Changes auto-save")


# =========================
# Main
# =========================

def main() -> None:
    st.set_page_config(
        page_title="Family Tree Builder", 
        page_icon="🌳", 
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    st.title("🌳 Interactive Family Tree Builder")
    st.caption("Build comprehensive family trees with auto-save and rich annotations")
    
    ensure_state()
    
    tab1, tab2, tab3 = st.tabs(["➕ Add Person", "⚡ Quick Add", "🔗 Link Existing"])
    
    with tab1:
        add_person_section()
    
    with tab2:
        quick_add_section()
    
    with tab3:
        link_existing_section()
    
    st.divider()
    tree_section()
    render_sidebar()


if __name__ == "__main__":
    main()
