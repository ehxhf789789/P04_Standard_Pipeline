"""
BCF Handler - BIM Collaboration Format 3.0

Implements BCF (BIM Collaboration Format) 3.0 according to buildingSMART standards
for creating, managing, and exchanging BIM-based issues and coordination feedback.

BCF 3.0 Standard: https://github.com/buildingSMART/BCF-XML/tree/release_3_0

Key Components:
- Topic: Issue container with metadata
- Viewpoint: 3D camera position and visibility settings
- Comment: Discussion thread on a topic
- Component: IFC element references
- Document Reference: External document links

BCF-XML Package Structure:
├── bcf.version
├── extensions.xml
├── project.bcfp
└── {topic-guid}/
    ├── markup.bcf
    ├── viewpoint.bcfv (multiple allowed)
    └── snapshot.png (per viewpoint)
"""

import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Any
import json
import zipfile
import io
import logging

logger = logging.getLogger(__name__)


class TopicType(Enum):
    """BCF topic types"""
    ERROR = "Error"
    WARNING = "Warning"
    INFO = "Info"
    REQUEST = "Request"
    COMMENT = "Comment"
    CLASH = "Clash"
    ISSUE = "Issue"


class TopicStatus(Enum):
    """BCF topic status"""
    OPEN = "Open"
    IN_PROGRESS = "InProgress"
    CLOSED = "Closed"
    RESOLVED = "Resolved"
    REOPENED = "ReOpened"


class Priority(Enum):
    """BCF topic priority"""
    LOW = "Low"
    NORMAL = "Normal"
    HIGH = "High"
    CRITICAL = "Critical"


class TopicLabel(Enum):
    """BCF topic labels (customizable)"""
    ARCHITECTURE = "Architecture"
    STRUCTURE = "Structure"
    MEP = "MEP"
    COORDINATION = "Coordination"
    VALIDATION = "Validation"
    COMPLIANCE = "Compliance"
    SAFETY = "Safety"
    ACCESSIBILITY = "Accessibility"


@dataclass
class Vector3D:
    """3D vector for camera and element positioning"""
    x: float
    y: float
    z: float

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "z": self.z}

    @classmethod
    def from_dict(cls, data: dict) -> "Vector3D":
        return cls(x=data["x"], y=data["y"], z=data["z"])


@dataclass
class OrthogonalCamera:
    """Orthogonal camera viewpoint"""
    camera_view_point: Vector3D
    camera_direction: Vector3D
    camera_up_vector: Vector3D
    view_to_world_scale: float = 1.0

    def to_xml(self, parent: ET.Element) -> None:
        camera = ET.SubElement(parent, "OrthogonalCamera")

        cvp = ET.SubElement(camera, "CameraViewPoint")
        ET.SubElement(cvp, "X").text = str(self.camera_view_point.x)
        ET.SubElement(cvp, "Y").text = str(self.camera_view_point.y)
        ET.SubElement(cvp, "Z").text = str(self.camera_view_point.z)

        cd = ET.SubElement(camera, "CameraDirection")
        ET.SubElement(cd, "X").text = str(self.camera_direction.x)
        ET.SubElement(cd, "Y").text = str(self.camera_direction.y)
        ET.SubElement(cd, "Z").text = str(self.camera_direction.z)

        cuv = ET.SubElement(camera, "CameraUpVector")
        ET.SubElement(cuv, "X").text = str(self.camera_up_vector.x)
        ET.SubElement(cuv, "Y").text = str(self.camera_up_vector.y)
        ET.SubElement(cuv, "Z").text = str(self.camera_up_vector.z)

        ET.SubElement(camera, "ViewToWorldScale").text = str(self.view_to_world_scale)


@dataclass
class PerspectiveCamera:
    """Perspective camera viewpoint"""
    camera_view_point: Vector3D
    camera_direction: Vector3D
    camera_up_vector: Vector3D
    field_of_view: float = 60.0

    def to_xml(self, parent: ET.Element) -> None:
        camera = ET.SubElement(parent, "PerspectiveCamera")

        cvp = ET.SubElement(camera, "CameraViewPoint")
        ET.SubElement(cvp, "X").text = str(self.camera_view_point.x)
        ET.SubElement(cvp, "Y").text = str(self.camera_view_point.y)
        ET.SubElement(cvp, "Z").text = str(self.camera_view_point.z)

        cd = ET.SubElement(camera, "CameraDirection")
        ET.SubElement(cd, "X").text = str(self.camera_direction.x)
        ET.SubElement(cd, "Y").text = str(self.camera_direction.y)
        ET.SubElement(cd, "Z").text = str(self.camera_direction.z)

        cuv = ET.SubElement(camera, "CameraUpVector")
        ET.SubElement(cuv, "X").text = str(self.camera_up_vector.x)
        ET.SubElement(cuv, "Y").text = str(self.camera_up_vector.y)
        ET.SubElement(cuv, "Z").text = str(self.camera_up_vector.z)

        ET.SubElement(camera, "FieldOfView").text = str(self.field_of_view)


@dataclass
class Component:
    """BCF component reference to an IFC element"""
    ifc_guid: str
    originating_system: Optional[str] = None
    authoring_tool_id: Optional[str] = None
    ifc_entity: Optional[str] = None

    def to_xml(self, parent: ET.Element) -> None:
        comp = ET.SubElement(parent, "Component", {"IfcGuid": self.ifc_guid})
        if self.originating_system:
            ET.SubElement(comp, "OriginatingSystem").text = self.originating_system
        if self.authoring_tool_id:
            ET.SubElement(comp, "AuthoringToolId").text = self.authoring_tool_id

    def to_dict(self) -> dict:
        return {
            "ifcGuid": self.ifc_guid,
            "originatingSystem": self.originating_system,
            "authoringToolId": self.authoring_tool_id,
            "ifcEntity": self.ifc_entity
        }


@dataclass
class ComponentColoring:
    """Coloring specification for components"""
    color: str  # ARGB hex (e.g., "FF00FF00")
    components: list[Component] = field(default_factory=list)

    def to_xml(self, parent: ET.Element) -> None:
        coloring = ET.SubElement(parent, "Coloring")
        color_elem = ET.SubElement(coloring, "Color", {"Color": self.color})
        for comp in self.components:
            comp.to_xml(color_elem)


@dataclass
class ComponentVisibility:
    """Visibility settings for components"""
    default_visibility: bool = True
    exceptions: list[Component] = field(default_factory=list)
    view_setup_hints: Optional[dict] = None

    def to_xml(self, parent: ET.Element) -> None:
        visibility = ET.SubElement(parent, "Visibility", {
            "DefaultVisibility": str(self.default_visibility).lower()
        })

        if self.exceptions:
            exceptions_elem = ET.SubElement(visibility, "Exceptions")
            for comp in self.exceptions:
                comp.to_xml(exceptions_elem)

        if self.view_setup_hints:
            hints = ET.SubElement(visibility, "ViewSetupHints")
            for key, value in self.view_setup_hints.items():
                hints.set(key, str(value).lower())


@dataclass
class Viewpoint:
    """BCF viewpoint with camera position and component visibility"""
    guid: str = field(default_factory=lambda: str(uuid.uuid4()))
    orthogonal_camera: Optional[OrthogonalCamera] = None
    perspective_camera: Optional[PerspectiveCamera] = None
    components: list[Component] = field(default_factory=list)
    visibility: Optional[ComponentVisibility] = None
    coloring: list[ComponentColoring] = field(default_factory=list)
    snapshot_filename: Optional[str] = None
    index: int = 0

    def to_bcfv(self) -> str:
        """Generate viewpoint.bcfv XML content"""
        root = ET.Element("VisualizationInfo", {
            "Guid": self.guid,
            "xmlns": "http://www.buildingsmart-tech.org/bcf/v3"
        })

        # Components
        if self.components:
            comps = ET.SubElement(root, "Components")

            # Visibility
            if self.visibility:
                self.visibility.to_xml(comps)

            # Selection
            selection = ET.SubElement(comps, "Selection")
            for comp in self.components:
                comp.to_xml(selection)

            # Coloring
            for color in self.coloring:
                color.to_xml(comps)

        # Camera
        if self.orthogonal_camera:
            self.orthogonal_camera.to_xml(root)
        elif self.perspective_camera:
            self.perspective_camera.to_xml(root)

        return ET.tostring(root, encoding='unicode', xml_declaration=True)

    def to_dict(self) -> dict:
        return {
            "guid": self.guid,
            "index": self.index,
            "snapshotFilename": self.snapshot_filename,
            "components": [c.to_dict() for c in self.components],
            "hasPerspectiveCamera": self.perspective_camera is not None,
            "hasOrthogonalCamera": self.orthogonal_camera is not None
        }


@dataclass
class Comment:
    """BCF comment in a topic discussion thread"""
    guid: str = field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime = field(default_factory=datetime.now)
    author: str = ""
    comment_text: str = ""
    viewpoint_guid: Optional[str] = None
    modified_date: Optional[datetime] = None
    modified_author: Optional[str] = None

    def to_xml(self, parent: ET.Element) -> None:
        comment = ET.SubElement(parent, "Comment", {"Guid": self.guid})
        ET.SubElement(comment, "Date").text = self.date.isoformat()
        ET.SubElement(comment, "Author").text = self.author
        ET.SubElement(comment, "Comment").text = self.comment_text

        if self.viewpoint_guid:
            ET.SubElement(comment, "Viewpoint", {"Guid": self.viewpoint_guid})

        if self.modified_date:
            ET.SubElement(comment, "ModifiedDate").text = self.modified_date.isoformat()
        if self.modified_author:
            ET.SubElement(comment, "ModifiedAuthor").text = self.modified_author

    def to_dict(self) -> dict:
        return {
            "guid": self.guid,
            "date": self.date.isoformat(),
            "author": self.author,
            "commentText": self.comment_text,
            "viewpointGuid": self.viewpoint_guid,
            "modifiedDate": self.modified_date.isoformat() if self.modified_date else None,
            "modifiedAuthor": self.modified_author
        }


@dataclass
class DocumentReference:
    """Reference to external document"""
    guid: str = field(default_factory=lambda: str(uuid.uuid4()))
    url: Optional[str] = None
    description: Optional[str] = None
    document_guid: Optional[str] = None

    def to_xml(self, parent: ET.Element) -> None:
        doc_ref = ET.SubElement(parent, "DocumentReference", {"Guid": self.guid})
        if self.url:
            ET.SubElement(doc_ref, "Url").text = self.url
        if self.description:
            ET.SubElement(doc_ref, "Description").text = self.description
        if self.document_guid:
            ET.SubElement(doc_ref, "DocumentGuid").text = self.document_guid


@dataclass
class Topic:
    """BCF Topic - main issue container"""
    guid: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    description: str = ""
    creation_date: datetime = field(default_factory=datetime.now)
    creation_author: str = ""
    modified_date: Optional[datetime] = None
    modified_author: Optional[str] = None
    topic_type: TopicType = TopicType.ISSUE
    topic_status: TopicStatus = TopicStatus.OPEN
    priority: Optional[Priority] = None
    index: int = 0
    labels: list[str] = field(default_factory=list)
    assigned_to: Optional[str] = None
    due_date: Optional[datetime] = None
    stage: Optional[str] = None  # BIM stage reference

    # Related elements
    reference_links: list[str] = field(default_factory=list)
    document_references: list[DocumentReference] = field(default_factory=list)
    related_topics: list[str] = field(default_factory=list)  # Topic GUIDs

    # Viewpoints and comments
    viewpoints: list[Viewpoint] = field(default_factory=list)
    comments: list[Comment] = field(default_factory=list)

    # Validation specific
    validation_source: Optional[str] = None  # "IDS", "LOIN", "bSDD"
    validation_rule_id: Optional[str] = None
    affected_elements: list[str] = field(default_factory=list)  # IFC GUIDs

    def to_markup(self) -> str:
        """Generate markup.bcf XML content"""
        root = ET.Element("Markup", {"xmlns": "http://www.buildingsmart-tech.org/bcf/v3"})

        # Header (optional file references)
        header = ET.SubElement(root, "Header")

        # Topic
        topic = ET.SubElement(root, "Topic", {
            "Guid": self.guid,
            "TopicType": self.topic_type.value,
            "TopicStatus": self.topic_status.value
        })

        # Reference links
        for link in self.reference_links:
            ET.SubElement(topic, "ReferenceLink").text = link

        ET.SubElement(topic, "Title").text = self.title

        if self.priority:
            ET.SubElement(topic, "Priority").text = self.priority.value

        ET.SubElement(topic, "Index").text = str(self.index)

        for label in self.labels:
            ET.SubElement(topic, "Labels").text = label

        ET.SubElement(topic, "CreationDate").text = self.creation_date.isoformat()
        ET.SubElement(topic, "CreationAuthor").text = self.creation_author

        if self.modified_date:
            ET.SubElement(topic, "ModifiedDate").text = self.modified_date.isoformat()
        if self.modified_author:
            ET.SubElement(topic, "ModifiedAuthor").text = self.modified_author

        if self.due_date:
            ET.SubElement(topic, "DueDate").text = self.due_date.isoformat()

        if self.assigned_to:
            ET.SubElement(topic, "AssignedTo").text = self.assigned_to

        if self.stage:
            ET.SubElement(topic, "Stage").text = self.stage

        if self.description:
            ET.SubElement(topic, "Description").text = self.description

        # Document references
        for doc_ref in self.document_references:
            doc_ref.to_xml(topic)

        # Related topics
        for related_guid in self.related_topics:
            ET.SubElement(topic, "RelatedTopic", {"Guid": related_guid})

        # Comments
        for comment in self.comments:
            comment.to_xml(root)

        # Viewpoints
        viewpoints_elem = ET.SubElement(root, "Viewpoints")
        for vp in self.viewpoints:
            vp_elem = ET.SubElement(viewpoints_elem, "ViewPoint", {"Guid": vp.guid})
            ET.SubElement(vp_elem, "Viewpoint").text = f"viewpoint_{vp.index}.bcfv"
            if vp.snapshot_filename:
                ET.SubElement(vp_elem, "Snapshot").text = vp.snapshot_filename
            ET.SubElement(vp_elem, "Index").text = str(vp.index)

        return ET.tostring(root, encoding='unicode', xml_declaration=True)

    def to_dict(self) -> dict:
        return {
            "guid": self.guid,
            "title": self.title,
            "description": self.description,
            "creationDate": self.creation_date.isoformat(),
            "creationAuthor": self.creation_author,
            "modifiedDate": self.modified_date.isoformat() if self.modified_date else None,
            "modifiedAuthor": self.modified_author,
            "topicType": self.topic_type.value,
            "topicStatus": self.topic_status.value,
            "priority": self.priority.value if self.priority else None,
            "index": self.index,
            "labels": self.labels,
            "assignedTo": self.assigned_to,
            "dueDate": self.due_date.isoformat() if self.due_date else None,
            "stage": self.stage,
            "validationSource": self.validation_source,
            "validationRuleId": self.validation_rule_id,
            "affectedElements": self.affected_elements,
            "viewpoints": [v.to_dict() for v in self.viewpoints],
            "comments": [c.to_dict() for c in self.comments]
        }


@dataclass
class BCFProject:
    """BCF Project container"""
    project_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    extension_schema: Optional[str] = None
    topics: list[Topic] = field(default_factory=list)

    def to_bcfp(self) -> str:
        """Generate project.bcfp XML content"""
        root = ET.Element("ProjectInfo", {"xmlns": "http://www.buildingsmart-tech.org/bcf/v3"})
        project = ET.SubElement(root, "Project", {"ProjectId": self.project_id})
        ET.SubElement(project, "Name").text = self.name
        return ET.tostring(root, encoding='unicode', xml_declaration=True)


class BCFHandler:
    """
    Handler for BCF (BIM Collaboration Format) 3.0 files.

    Provides functionality for:
    - Creating BCF issues from validation results
    - Importing/exporting BCF-XML packages
    - Managing topics, viewpoints, and comments
    - Converting between BCF and internal formats
    """

    BCF_VERSION = "3.0"

    def __init__(self, project_name: str = ""):
        self.project = BCFProject(name=project_name)
        self._topic_index = 0

    def create_topic_from_validation(
        self,
        validation_result: dict,
        author: str = "BIM Pipeline",
        element_guid: Optional[str] = None,
        ifc_entity: Optional[str] = None
    ) -> Topic:
        """
        Create a BCF topic from a validation result.

        Args:
            validation_result: Validation result dictionary containing:
                - status: "pass", "fail", "warning"
                - facet: Validation facet (entity, property, etc.)
                - message: Error/warning message
                - requirement: IDS requirement name
                - rule_id: IDS rule identifier
            author: Author name for the topic
            element_guid: IFC GlobalId of the affected element
            ifc_entity: IFC entity type

        Returns:
            Created Topic instance
        """
        self._topic_index += 1

        status = validation_result.get("status", "fail")
        facet = validation_result.get("facet", "unknown")
        message = validation_result.get("message", "Validation issue")
        requirement = validation_result.get("requirement", "")
        rule_id = validation_result.get("rule_id", "")

        # Determine topic type and priority
        if status == "fail":
            topic_type = TopicType.ERROR
            priority = Priority.HIGH
        elif status == "warning":
            topic_type = TopicType.WARNING
            priority = Priority.NORMAL
        else:
            topic_type = TopicType.INFO
            priority = Priority.LOW

        # Create topic
        topic = Topic(
            title=f"[{facet.upper()}] {requirement}" if requirement else f"Validation: {facet}",
            description=message,
            creation_author=author,
            topic_type=topic_type,
            topic_status=TopicStatus.OPEN,
            priority=priority,
            index=self._topic_index,
            labels=[TopicLabel.VALIDATION.value, facet],
            validation_source="IDS",
            validation_rule_id=rule_id
        )

        # Add affected element
        if element_guid:
            topic.affected_elements.append(element_guid)

            # Create viewpoint with highlighted component
            viewpoint = Viewpoint(index=0)
            component = Component(
                ifc_guid=element_guid,
                originating_system="BIM Pipeline",
                ifc_entity=ifc_entity
            )
            viewpoint.components.append(component)

            # Color the failed element red
            viewpoint.coloring.append(ComponentColoring(
                color="FFFF0000",  # Red
                components=[component]
            ))

            topic.viewpoints.append(viewpoint)

        self.project.topics.append(topic)
        return topic

    def create_topic_from_loin_gap(
        self,
        element_id: str,
        ifc_entity: str,
        missing_properties: list[dict],
        lifecycle_phase: str,
        author: str = "BIM Pipeline"
    ) -> Topic:
        """
        Create a BCF topic from LOIN completeness gap.

        Args:
            element_id: Element identifier (IFC GlobalId)
            ifc_entity: IFC entity type
            missing_properties: List of missing property definitions
            lifecycle_phase: LOIN lifecycle phase
            author: Author name

        Returns:
            Created Topic instance
        """
        self._topic_index += 1

        # Format missing properties
        property_list = "\n".join([
            f"- {p.get('propertySet', '')}.{p.get('propertyName', '')}"
            for p in missing_properties
        ])

        topic = Topic(
            title=f"Missing LOIN Properties: {ifc_entity}",
            description=f"Element is missing required properties for {lifecycle_phase} phase:\n\n{property_list}",
            creation_author=author,
            topic_type=TopicType.WARNING,
            topic_status=TopicStatus.OPEN,
            priority=Priority.NORMAL,
            index=self._topic_index,
            labels=[TopicLabel.VALIDATION.value, "LOIN", lifecycle_phase],
            validation_source="LOIN",
            stage=lifecycle_phase,
            affected_elements=[element_id]
        )

        # Create viewpoint
        viewpoint = Viewpoint(index=0)
        viewpoint.components.append(Component(
            ifc_guid=element_id,
            originating_system="BIM Pipeline",
            ifc_entity=ifc_entity
        ))
        topic.viewpoints.append(viewpoint)

        self.project.topics.append(topic)
        return topic

    def create_topic_from_bsdd_mismatch(
        self,
        element_id: str,
        ifc_entity: str,
        invalid_values: list[dict],
        bsdd_class: str,
        author: str = "BIM Pipeline"
    ) -> Topic:
        """
        Create a BCF topic from bSDD value validation failure.

        Args:
            element_id: Element identifier
            ifc_entity: IFC entity type
            invalid_values: List of invalid property values
            bsdd_class: bSDD class name
            author: Author name

        Returns:
            Created Topic instance
        """
        self._topic_index += 1

        # Format invalid values
        issues = "\n".join([
            f"- {v.get('propertyName', '')}: {v.get('error', '')}"
            for v in invalid_values
        ])

        topic = Topic(
            title=f"bSDD Value Mismatch: {bsdd_class}",
            description=f"Element properties do not match bSDD specifications:\n\n{issues}",
            creation_author=author,
            topic_type=TopicType.WARNING,
            topic_status=TopicStatus.OPEN,
            priority=Priority.NORMAL,
            index=self._topic_index,
            labels=[TopicLabel.VALIDATION.value, "bSDD", TopicLabel.COMPLIANCE.value],
            validation_source="bSDD",
            affected_elements=[element_id]
        )

        # Add component
        viewpoint = Viewpoint(index=0)
        viewpoint.components.append(Component(
            ifc_guid=element_id,
            originating_system="BIM Pipeline",
            ifc_entity=ifc_entity
        ))
        viewpoint.coloring.append(ComponentColoring(
            color="FFFFAA00",  # Orange
            components=viewpoint.components.copy()
        ))
        topic.viewpoints.append(viewpoint)

        self.project.topics.append(topic)
        return topic

    def add_comment(
        self,
        topic_guid: str,
        comment_text: str,
        author: str,
        viewpoint_guid: Optional[str] = None
    ) -> Optional[Comment]:
        """Add a comment to an existing topic"""
        topic = self.get_topic(topic_guid)
        if not topic:
            logger.warning(f"Topic not found: {topic_guid}")
            return None

        comment = Comment(
            author=author,
            comment_text=comment_text,
            viewpoint_guid=viewpoint_guid
        )
        topic.comments.append(comment)
        topic.modified_date = datetime.now()
        topic.modified_author = author

        return comment

    def update_topic_status(
        self,
        topic_guid: str,
        status: TopicStatus,
        author: str
    ) -> bool:
        """Update a topic's status"""
        topic = self.get_topic(topic_guid)
        if not topic:
            return False

        topic.topic_status = status
        topic.modified_date = datetime.now()
        topic.modified_author = author
        return True

    def get_topic(self, guid: str) -> Optional[Topic]:
        """Get topic by GUID"""
        for topic in self.project.topics:
            if topic.guid == guid:
                return topic
        return None

    def get_topics_by_status(self, status: TopicStatus) -> list[Topic]:
        """Get all topics with a specific status"""
        return [t for t in self.project.topics if t.topic_status == status]

    def get_topics_by_validation_source(self, source: str) -> list[Topic]:
        """Get all topics from a specific validation source"""
        return [t for t in self.project.topics if t.validation_source == source]

    def get_topics_for_element(self, element_guid: str) -> list[Topic]:
        """Get all topics affecting a specific element"""
        return [
            t for t in self.project.topics
            if element_guid in t.affected_elements
        ]

    def export_bcf_zip(self, output_path: Optional[Path] = None) -> bytes:
        """
        Export BCF project to BCF-XML ZIP file.

        Args:
            output_path: Optional file path to write to

        Returns:
            BCF ZIP file contents as bytes
        """
        buffer = io.BytesIO()

        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # bcf.version
            version_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Version VersionId="{self.BCF_VERSION}" xmlns="http://www.buildingsmart-tech.org/bcf/v3">
    <DetailedVersion>{self.BCF_VERSION}</DetailedVersion>
</Version>'''
            zf.writestr("bcf.version", version_xml)

            # project.bcfp
            zf.writestr("project.bcfp", self.project.to_bcfp())

            # extensions.xml
            extensions_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<Extensions xmlns="http://www.buildingsmart-tech.org/bcf/v3">
    <TopicTypes>
        <TopicType>Error</TopicType>
        <TopicType>Warning</TopicType>
        <TopicType>Info</TopicType>
        <TopicType>Request</TopicType>
        <TopicType>Issue</TopicType>
        <TopicType>Clash</TopicType>
    </TopicTypes>
    <TopicStatuses>
        <TopicStatus>Open</TopicStatus>
        <TopicStatus>InProgress</TopicStatus>
        <TopicStatus>Closed</TopicStatus>
        <TopicStatus>Resolved</TopicStatus>
        <TopicStatus>ReOpened</TopicStatus>
    </TopicStatuses>
    <Priorities>
        <Priority>Low</Priority>
        <Priority>Normal</Priority>
        <Priority>High</Priority>
        <Priority>Critical</Priority>
    </Priorities>
    <TopicLabels>
        <TopicLabel>Architecture</TopicLabel>
        <TopicLabel>Structure</TopicLabel>
        <TopicLabel>MEP</TopicLabel>
        <TopicLabel>Coordination</TopicLabel>
        <TopicLabel>Validation</TopicLabel>
        <TopicLabel>Compliance</TopicLabel>
    </TopicLabels>
</Extensions>'''
            zf.writestr("extensions.xml", extensions_xml)

            # Topics
            for topic in self.project.topics:
                topic_dir = topic.guid

                # markup.bcf
                zf.writestr(f"{topic_dir}/markup.bcf", topic.to_markup())

                # Viewpoints
                for vp in topic.viewpoints:
                    vp_filename = f"viewpoint_{vp.index}.bcfv"
                    zf.writestr(f"{topic_dir}/{vp_filename}", vp.to_bcfv())

        result = buffer.getvalue()

        if output_path:
            with open(output_path, 'wb') as f:
                f.write(result)
            logger.info(f"Exported BCF to {output_path}")

        return result

    def import_bcf_zip(self, file_path: Path) -> None:
        """
        Import BCF project from BCF-XML ZIP file.

        Args:
            file_path: Path to BCF ZIP file
        """
        with zipfile.ZipFile(file_path, 'r') as zf:
            # Parse project
            if "project.bcfp" in zf.namelist():
                project_xml = zf.read("project.bcfp").decode('utf-8')
                self._parse_project(project_xml)

            # Find and parse topics
            topic_dirs = set()
            for name in zf.namelist():
                if "/" in name:
                    topic_dir = name.split("/")[0]
                    if topic_dir not in [".", ""]:
                        topic_dirs.add(topic_dir)

            for topic_dir in topic_dirs:
                markup_path = f"{topic_dir}/markup.bcf"
                if markup_path in zf.namelist():
                    markup_xml = zf.read(markup_path).decode('utf-8')
                    topic = self._parse_topic(markup_xml)

                    # Parse viewpoints
                    for i in range(10):  # Max 10 viewpoints per topic
                        vp_path = f"{topic_dir}/viewpoint_{i}.bcfv"
                        if vp_path in zf.namelist():
                            vp_xml = zf.read(vp_path).decode('utf-8')
                            viewpoint = self._parse_viewpoint(vp_xml)
                            viewpoint.index = i
                            topic.viewpoints.append(viewpoint)

                    self.project.topics.append(topic)

        logger.info(f"Imported BCF with {len(self.project.topics)} topics from {file_path}")

    def _parse_project(self, xml_content: str) -> None:
        """Parse project.bcfp XML"""
        root = ET.fromstring(xml_content)
        ns = {"bcf": "http://www.buildingsmart-tech.org/bcf/v3"}

        project_elem = root.find(".//bcf:Project", ns) or root.find(".//Project")
        if project_elem is not None:
            self.project.project_id = project_elem.get("ProjectId", str(uuid.uuid4()))
            name_elem = project_elem.find("bcf:Name", ns) or project_elem.find("Name")
            if name_elem is not None:
                self.project.name = name_elem.text or ""

    def _parse_topic(self, xml_content: str) -> Topic:
        """Parse markup.bcf XML to Topic"""
        root = ET.fromstring(xml_content)

        topic_elem = root.find(".//Topic")
        if topic_elem is None:
            raise ValueError("No Topic element found in markup")

        topic = Topic(
            guid=topic_elem.get("Guid", str(uuid.uuid4())),
            topic_type=TopicType(topic_elem.get("TopicType", "Issue")),
            topic_status=TopicStatus(topic_elem.get("TopicStatus", "Open"))
        )

        # Parse child elements
        title_elem = topic_elem.find("Title")
        if title_elem is not None:
            topic.title = title_elem.text or ""

        desc_elem = topic_elem.find("Description")
        if desc_elem is not None:
            topic.description = desc_elem.text or ""

        priority_elem = topic_elem.find("Priority")
        if priority_elem is not None and priority_elem.text:
            try:
                topic.priority = Priority(priority_elem.text)
            except ValueError:
                pass

        index_elem = topic_elem.find("Index")
        if index_elem is not None and index_elem.text:
            topic.index = int(index_elem.text)

        creation_date_elem = topic_elem.find("CreationDate")
        if creation_date_elem is not None and creation_date_elem.text:
            topic.creation_date = datetime.fromisoformat(creation_date_elem.text.replace('Z', '+00:00'))

        creation_author_elem = topic_elem.find("CreationAuthor")
        if creation_author_elem is not None:
            topic.creation_author = creation_author_elem.text or ""

        assigned_elem = topic_elem.find("AssignedTo")
        if assigned_elem is not None:
            topic.assigned_to = assigned_elem.text

        # Labels
        for label_elem in topic_elem.findall("Labels"):
            if label_elem.text:
                topic.labels.append(label_elem.text)

        # Comments
        for comment_elem in root.findall(".//Comment"):
            comment = self._parse_comment(comment_elem)
            topic.comments.append(comment)

        return topic

    def _parse_comment(self, elem: ET.Element) -> Comment:
        """Parse Comment XML element"""
        comment = Comment(guid=elem.get("Guid", str(uuid.uuid4())))

        date_elem = elem.find("Date")
        if date_elem is not None and date_elem.text:
            comment.date = datetime.fromisoformat(date_elem.text.replace('Z', '+00:00'))

        author_elem = elem.find("Author")
        if author_elem is not None:
            comment.author = author_elem.text or ""

        text_elem = elem.find("Comment")
        if text_elem is not None:
            comment.comment_text = text_elem.text or ""

        viewpoint_elem = elem.find("Viewpoint")
        if viewpoint_elem is not None:
            comment.viewpoint_guid = viewpoint_elem.get("Guid")

        return comment

    def _parse_viewpoint(self, xml_content: str) -> Viewpoint:
        """Parse viewpoint.bcfv XML"""
        root = ET.fromstring(xml_content)

        viewpoint = Viewpoint(guid=root.get("Guid", str(uuid.uuid4())))

        # Parse components
        components_elem = root.find(".//Components")
        if components_elem is not None:
            selection_elem = components_elem.find("Selection")
            if selection_elem is not None:
                for comp_elem in selection_elem.findall("Component"):
                    component = Component(
                        ifc_guid=comp_elem.get("IfcGuid", ""),
                        originating_system=comp_elem.findtext("OriginatingSystem"),
                        authoring_tool_id=comp_elem.findtext("AuthoringToolId")
                    )
                    viewpoint.components.append(component)

        return viewpoint

    def to_json(self) -> str:
        """Export BCF project to JSON format"""
        data = {
            "projectId": self.project.project_id,
            "projectName": self.project.name,
            "bcfVersion": self.BCF_VERSION,
            "exportedAt": datetime.now().isoformat(),
            "topics": [t.to_dict() for t in self.project.topics]
        }
        return json.dumps(data, indent=2, ensure_ascii=False)

    def get_summary(self) -> dict:
        """Get summary statistics of BCF topics"""
        status_counts = {}
        type_counts = {}
        source_counts = {}

        for topic in self.project.topics:
            status = topic.topic_status.value
            status_counts[status] = status_counts.get(status, 0) + 1

            ttype = topic.topic_type.value
            type_counts[ttype] = type_counts.get(ttype, 0) + 1

            if topic.validation_source:
                source_counts[topic.validation_source] = source_counts.get(topic.validation_source, 0) + 1

        return {
            "totalTopics": len(self.project.topics),
            "byStatus": status_counts,
            "byType": type_counts,
            "byValidationSource": source_counts,
            "openIssues": status_counts.get("Open", 0),
            "criticalIssues": len([
                t for t in self.project.topics
                if t.priority == Priority.CRITICAL and t.topic_status == TopicStatus.OPEN
            ])
        }
