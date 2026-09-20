<?php
require_once 'auth.php';
include 'db_connect.php';
require_once 'schema_utils.php';
require_once 'cache_headers.php';

$authUser = requireAuthenticatedUser('teacher');
$teacher_id = (int)$authUser['user_id'];

try {
    ensureAssessmentRubricColumn($conn);
    ensureAssessmentDueDate($conn);
    ensureItemRubricColumn($conn);
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);
    $semesterTable = resolveExistingTableName($conn, ['Semester', 'semester']);

    $stmt = $conn->prepare(
        "SELECT
            ep.exercise_id,
            ep.subject_id,
            ep.rubric_set_id,
            ep.title,
            ep.description,
            ep.topic,
            ep.difficulty,
            ep.due_date,
            ep.is_published,
            ep.last_draft_save,
            ep.created_at AS date_created,
            rs.rubric_name,
            COALESCE(s.subject_name, 'Unassigned Subject') AS subject_name,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            COALESCE(sem.semester_name, s.semester) AS semester,
            COALESCE(sy.label, '') AS school_year,
            CASE
                WHEN ep.is_published = 0 THEN 'Draft'
                WHEN EXISTS (
                    SELECT 1
                    FROM Scores sc
                    JOIN Captured_Solution cs ON sc.solution_id = cs.solution_id
                    WHERE cs.exercise_id = ep.exercise_id
                ) THEN 'Graded'
                WHEN EXISTS (
                    SELECT 1
                    FROM Captured_Solution cs
                    WHERE cs.exercise_id = ep.exercise_id
                ) THEN 'Pending'
                ELSE 'Published'
            END AS assessment_status
         FROM exercises_problem ep
         LEFT JOIN subject s ON ep.subject_id = s.subject_id
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
         LEFT JOIN school_year sy ON sy.school_year_id = s.school_year_id
         LEFT JOIN rubric_sets rs ON rs.rubric_set_id = ep.rubric_set_id
         WHERE s.teacher_user_id = ?
         ORDER BY ep.created_at DESC"
    );
    $stmt->bind_param("i", $teacher_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $assessmentsById = [];
    while ($row = $result->fetch_assoc()) {
        $subjectMeta = [];
        foreach (['course', 'section', 'semester', 'school_year'] as $field) {
            if (!empty($row[$field])) {
                $subjectMeta[] = $row[$field];
            }
        }

        $exerciseId = (int)$row["exercise_id"];
        $assessmentsById[$exerciseId] = [
            "exercise_id" => $exerciseId,
            "subject_id" => isset($row["subject_id"]) ? (int)$row["subject_id"] : null,
            "rubric_set_id" => isset($row["rubric_set_id"]) ? (int)$row["rubric_set_id"] : null,
            "rubric_name" => $row["rubric_name"] ?? null,
            "title" => $row["title"],
            "description" => $row["description"],
            "topic" => $row["topic"],
            "difficulty" => $row["difficulty"] ?? 'Medium',
            "due_date" => $row["due_date"] ?? null,
            "is_published" => (int)($row["is_published"] ?? 0),
            "last_draft_save" => $row["last_draft_save"] ?? null,
            "subject" => $row["subject_name"],
            "subject_meta" => implode(" - ", $subjectMeta),
            "subjects" => [], // Will be populated below
            "date_created" => $row["date_created"],
            "assessment_status" => $row["assessment_status"],
            "status" => $row["assessment_status"],
            "item_count" => 0,
            "items" => [],
        ];
    }
    $stmt->close();

    // Load all linked subjects from assessment_subjects
    if (count($assessmentsById) > 0) {
        $exerciseIds = array_keys($assessmentsById);
        $placeholders = implode(',', array_fill(0, count($exerciseIds), '?'));
        $types = str_repeat('i', count($exerciseIds));

        $asStmt = $conn->prepare(
            "SELECT
                asub.assessment_id,
                s.subject_id,
                s.subject_name,
                COALESCE(c.course_code, c.course_name) AS course,
                sec.section_name AS section,
                COALESCE(sem.semester_name, s.semester) AS semester,
                COALESCE(sy.label, '') AS school_year
             FROM assessment_subjects asub
             INNER JOIN subject s ON asub.subject_id = s.subject_id
             LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
             LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
             LEFT JOIN {$semesterTable} sem ON sem.semester_id = s.semester_id
             LEFT JOIN school_year sy ON sy.school_year_id = s.school_year_id
             WHERE asub.assessment_id IN ({$placeholders})
             ORDER BY asub.assessment_id, s.subject_name"
        );
        $asStmt->bind_param($types, ...$exerciseIds);
        $asStmt->execute();
        $asResult = $asStmt->get_result();

        while ($asRow = $asResult->fetch_assoc()) {
            $eid = (int)$asRow['assessment_id'];
            if (!isset($assessmentsById[$eid])) continue;

            $meta = [];
            foreach (['course', 'section', 'semester', 'school_year'] as $field) {
                if (!empty($asRow[$field])) {
                    $meta[] = $asRow[$field];
                }
            }

            $assessmentsById[$eid]['subjects'][] = [
                'subject_id' => (int)$asRow['subject_id'],
                'subject_name' => $asRow['subject_name'],
                'subject_meta' => implode(' - ', $meta),
            ];
        }
        $asStmt->close();

        // If no assessment_subjects rows exist, fall back to primary subject
        foreach ($assessmentsById as $eid => &$assessment) {
            if (empty($assessment['subjects'])) {
                $assessment['subjects'] = [[
                    'subject_id' => $assessment['subject_id'],
                    'subject_name' => $assessment['subject'],
                    'subject_meta' => $assessment['subject_meta'],
                ]];
            }
        }
        unset($assessment);
    }

    if (count($assessmentsById) > 0) {
        $itemStmt = $conn->prepare(
            "SELECT
                ei.item_id,
                ei.exercise_id,
                ei.rubric_set_id,
                ei.item_no,
                ei.question_type,
                ei.question_content,
                ei.max_score,
                rs.rubric_name
             FROM exercise_items ei
             INNER JOIN exercises_problem ep ON ei.exercise_id = ep.exercise_id
             INNER JOIN subject s ON ep.subject_id = s.subject_id
             LEFT JOIN rubric_sets rs ON rs.rubric_set_id = ei.rubric_set_id
             WHERE s.teacher_user_id = ?
             ORDER BY ei.exercise_id ASC, ei.item_no ASC"
        );
        $itemStmt->bind_param("i", $teacher_id);
        $itemStmt->execute();
        $itemResult = $itemStmt->get_result();

        while ($itemRow = $itemResult->fetch_assoc()) {
            $exerciseId = (int)$itemRow['exercise_id'];
            if (!isset($assessmentsById[$exerciseId])) {
                continue;
            }

            $assessmentsById[$exerciseId]['items'][] = [
                "item_id" => (int)$itemRow['item_id'],
                "item_no" => (int)$itemRow['item_no'],
                "question_type" => $itemRow['question_type'] ?? 'handwritten_algebra',
                "question_content" => $itemRow['question_content'],
                "max_score" => isset($itemRow['max_score']) ? (float)$itemRow['max_score'] : 1.0,
                "rubric_set_id" => isset($itemRow['rubric_set_id']) ? (int)$itemRow['rubric_set_id'] : null,
                "rubric_name" => $itemRow['rubric_name'] ?? null,
            ];
            $assessmentsById[$exerciseId]['item_count']++;
        }
        $itemStmt->close();
    }

    setCacheHeaders(60);
    echo json_encode(["status" => "success", "assessments" => array_values($assessmentsById)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Unable to load assessments."]);
}

$conn->close();
?>
