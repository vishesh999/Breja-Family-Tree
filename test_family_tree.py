"""
Unit tests for Family Tree Builder
Run with: pytest test_family_tree.py -v
"""

import pytest
from main import Person, FamilyTree, tree_to_json, json_to_tree


class TestPersonModel:
    """Tests for Person dataclass."""
    
    def test_person_creation(self):
        """Test creating a person."""
        p = Person(id="p1", name="John", sex="M", birth_year=1980)
        assert p.id == "p1"
        assert p.name == "John"
        assert p.sex == "M"
        assert p.birth_year == 1980
    
    def test_add_child(self):
        """Test adding child to person."""
        parent = Person(id="p1", name="Parent")
        parent.add_child("c1")
        assert "c1" in parent.children_ids
    
    def test_add_duplicate_child_ignored(self):
        """Test that duplicate children are not added twice."""
        parent = Person(id="p1", name="Parent")
        parent.add_child("c1")
        parent.add_child("c1")
        assert parent.children_ids.count("c1") == 1
    
    def test_add_spouse(self):
        """Test adding spouse."""
        p1 = Person(id="p1", name="Person1")
        p1.add_spouse("p2")
        assert "p2" in p1.spouse_ids
    
    def test_cannot_be_own_spouse(self):
        """Test that person cannot be their own spouse."""
        p = Person(id="p1", name="Person")
        p.add_spouse("p1")
        assert "p1" not in p.spouse_ids
    
    def test_remove_child(self):
        """Test removing child."""
        parent = Person(id="p1", name="Parent")
        parent.add_child("c1")
        parent.remove_child("c1")
        assert "c1" not in parent.children_ids


class TestFamilyTreeValidation:
    """Tests for FamilyTree validation logic."""
    
    def test_validate_dates_valid(self):
        """Test valid date validation."""
        ft = FamilyTree()
        valid, msg = ft.validate_dates(1980, 2020)
        assert valid is True
    
    def test_validate_dates_death_before_birth(self):
        """Test death year cannot be before birth year."""
        ft = FamilyTree()
        valid, msg = ft.validate_dates(2020, 1980)
        assert valid is False
        assert "Death year cannot be before birth year" in msg
    
    def test_validate_dates_none_values(self):
        """Test that None values are valid."""
        ft = FamilyTree()
        valid, msg = ft.validate_dates(None, None)
        assert valid is True
        valid, msg = ft.validate_dates(1980, None)
        assert valid is True
    
    def test_validate_parent_child_dates_valid(self):
        """Test valid parent-child dates."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", birth_year=1980)
        child = Person(id="c1", name="Child", birth_year=2000)
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        valid, msg = ft.validate_parent_child_dates("p1", "c1")
        assert valid is True
    
    def test_validate_parent_child_dates_child_born_before_parent(self):
        """Test that child cannot be born before parent."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", birth_year=2000)
        child = Person(id="c1", name="Child", birth_year=1980)
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        valid, msg = ft.validate_parent_child_dates("p1", "c1")
        assert valid is False
        assert "Parent must be born before child" in msg
    
    def test_validate_parent_child_age_gap_too_small(self):
        """Test that parent should be at least 10 years older."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", birth_year=1995)
        child = Person(id="c1", name="Child", birth_year=2000)
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        valid, msg = ft.validate_parent_child_dates("p1", "c1")
        assert valid is False
        assert "10 years" in msg
        assert "only 5 years apart" in msg
    
    def test_validate_parent_child_age_gap_unrealistic(self):
        """Test that age gap cannot be >70 years."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", birth_year=1920)
        child = Person(id="c1", name="Child", birth_year=2000)
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        valid, msg = ft.validate_parent_child_dates("p1", "c1")
        assert valid is False
        assert "80 years" in msg or "Unrealistic" in msg


class TestFamilyTreeCircularReference:
    """Tests for circular reference detection."""
    
    def test_no_circular_reference_simple(self):
        """Test that simple parent-child link has no circular reference."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent")
        child = Person(id="c1", name="Child")
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        assert ft.has_circular_reference("p1", "c1") is False
    
    def test_circular_reference_direct(self):
        """Test that child cannot be parent of their parent."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent")
        child = Person(id="c1", name="Child")
        parent.add_child("c1")
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        assert ft.has_circular_reference("c1", "p1") is True
    
    def test_circular_reference_deep(self):
        """Test circular reference detection through multiple generations."""
        ft = FamilyTree()
        # p1 -> c1 -> gc1
        p1 = Person(id="p1", name="Parent")
        c1 = Person(id="c1", name="Child")
        gc1 = Person(id="gc1", name="Grandchild")
        
        p1.add_child("c1")
        c1.add_child("gc1")
        
        ft.people["p1"] = p1
        ft.people["c1"] = c1
        ft.people["gc1"] = gc1
        
        # gc1 cannot be ancestor of p1
        assert ft.has_circular_reference("gc1", "p1") is True


class TestFamilyTreeLinks:
    """Tests for family relationships."""
    
    def test_link_parent_child_success(self):
        """Test successful parent-child link."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", sex="M", birth_year=1980)
        child = Person(id="c1", name="Child", birth_year=2000)
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        success, msg = ft.link_parent_child("p1", "c1", "father")
        assert success is True
        assert child.father_id == "p1"
        assert "c1" in parent.children_ids
    
    def test_link_parent_child_self_link_fails(self):
        """Test that person cannot be their own parent."""
        ft = FamilyTree()
        person = Person(id="p1", name="Person")
        ft.people["p1"] = person
        
        success, msg = ft.link_parent_child("p1", "p1", "father")
        assert success is False
        assert "cannot be their own parent" in msg
    
    def test_link_parent_child_sex_mismatch(self):
        """Test that sex must match role."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", sex="F")
        child = Person(id="c1", name="Child")
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        success, msg = ft.link_parent_child("p1", "c1", "father")
        assert success is False
        assert "Cannot assign female as father" in msg
    
    def test_link_parent_child_circular_fails(self):
        """Test that circular reference prevents linking."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", sex="M")
        child = Person(id="c1", name="Child", sex="M")
        parent.add_child("c1")
        ft.people["p1"] = parent
        ft.people["c1"] = child
        
        success, msg = ft.link_parent_child("c1", "p1", "father")
        assert success is False
        assert "circular reference" in msg
    
    def test_link_spouses_success(self):
        """Test successful spouse link."""
        ft = FamilyTree()
        p1 = Person(id="p1", name="Person1")
        p2 = Person(id="p2", name="Person2")
        ft.people["p1"] = p1
        ft.people["p2"] = p2
        
        success, msg = ft.link_spouses("p1", "p2")
        assert success is True
        assert "p2" in p1.spouse_ids
        assert "p1" in p2.spouse_ids
    
    def test_delete_person_cleanup(self):
        """Test that deleting person cleans up all references."""
        ft = FamilyTree()
        parent = Person(id="p1", name="Parent", sex="M")
        child = Person(id="c1", name="Child")
        spouse = Person(id="s1", name="Spouse")
        
        parent.add_child("c1")
        parent.add_spouse("s1")
        child.father_id = "p1"
        spouse.spouse_ids.add("p1")
        
        ft.people["p1"] = parent
        ft.people["c1"] = child
        ft.people["s1"] = spouse
        
        success, msg = ft.delete_person("p1")
        assert success is True
        assert "p1" not in ft.people
        assert child.father_id is None
        assert "p1" not in spouse.spouse_ids


class TestFamilyTreeDerivedRelations:
    """Tests for derived relationship queries."""
    
    def setup_method(self):
        """Set up a sample family tree."""
        self.ft = FamilyTree()
        
        # Create: grandfather -> parent -> child
        gf = Person(id="gf", name="Grandfather", sex="M", birth_year=1950)
        p = Person(id="p", name="Parent", sex="M", birth_year=1970)
        c = Person(id="c", name="Child", sex="M", birth_year=1990)
        
        gf.add_child("p")
        p.father_id = "gf"
        p.add_child("c")
        c.father_id = "p"
        
        self.ft.people["gf"] = gf
        self.ft.people["p"] = p
        self.ft.people["c"] = c
    
    def test_parents_of(self):
        """Test getting parents."""
        parents = self.ft.parents_of("c")
        assert parents == ["p"]
    
    def test_grandparents_of(self):
        """Test getting grandparents."""
        gps = self.ft.grandparents_of("c")
        assert "gf" in gps
    
    def test_roots(self):
        """Test getting root persons (no parents)."""
        roots = self.ft.roots()
        assert roots == ["gf"]


class TestSerialization:
    """Tests for JSON serialization/deserialization."""
    
    def test_tree_to_json_and_back(self):
        """Test round-trip JSON serialization."""
        ft = FamilyTree()
        p = Person(
            id="p1", name="Person", sex="M",
            birth_year=1980, death_year=2020,
            notes="Test person", image="img/test.jpg"
        )
        ft.people["p1"] = p
        
        json_str = tree_to_json(ft)
        ft_restored = json_to_tree(json_str)
        
        assert len(ft_restored.people) == 1
        p_restored = ft_restored.people["p1"]
        assert p_restored.name == "Person"
        assert p_restored.sex == "M"
        assert p_restored.birth_year == 1980
        assert p_restored.notes == "Test person"
        assert p_restored.image == "img/test.jpg"
    
    def test_json_with_relationships(self):
        """Test JSON serialization with relationships."""
        ft = FamilyTree()
        p1 = Person(id="p1", name="Parent", sex="M", birth_year=1980)
        p2 = Person(id="p2", name="Child", birth_year=2000)
        
        p1.add_child("p2")
        p2.father_id = "p1"
        
        ft.people["p1"] = p1
        ft.people["p2"] = p2
        
        json_str = tree_to_json(ft)
        ft_restored = json_to_tree(json_str)
        
        assert "p2" in ft_restored.people["p1"].children_ids
        assert ft_restored.people["p2"].father_id == "p1"
    
    def test_json_with_spouses(self):
        """Test JSON serialization with spouse relationships."""
        ft = FamilyTree()
        p1 = Person(id="p1", name="Person1")
        p2 = Person(id="p2", name="Person2")
        
        p1.add_spouse("p2")
        p2.add_spouse("p1")
        
        ft.people["p1"] = p1
        ft.people["p2"] = p2
        
        json_str = tree_to_json(ft)
        ft_restored = json_to_tree(json_str)
        
        assert "p2" in ft_restored.people["p1"].spouse_ids
        assert "p1" in ft_restored.people["p2"].spouse_ids


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
