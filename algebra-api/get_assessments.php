<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

include 'db_connect.php';
require_once 'schema_utils.php';

$teacher_id = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : null;

if (!$teacher_id) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Teacher ID is required."]);
    exit;
}

try {
    ensureAssessmentRubricColumn($conn);
    ensureSubjectLookupColumns($conn);
    $courseTable = resolveExistingTableName($conn, ['Course', 'course']);
    $sectionTable = resolveExistingTableName($conn, ['Section', 'section']);

    $stmt = $conn->prepare(
        "SELECT
            ep.exercise_id,
            ep.subject_id,
            ep.rubric_set_id,
            ep.title,
            ep.description,
            ep.topic,
            ep.difficulty,
            ep.date_created,
            rs.rubric_name,
            COALESCE(s.subject_name, 'Unassigned Subject') AS subject_name,
            COALESCE(c.course_code, c.course_name) AS course,
            sec.section_name AS section,
            s.semester,
            s.school_year,
            CASE
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
                ELSE 'Draft'
            END AS assessment_status
         FROM exercises_problem ep
         LEFT JOIN subject s ON ep.subject_id = s.subject_id
         LEFT JOIN {$courseTable} c ON c.course_id = s.course_id
         LEFT JOIN {$sectionTable} sec ON sec.section_id = s.section_id
         LEFT JOIN rubric_sets rs ON rs.rubric_set_id = ep.rubric_set_id
         WHERE s.teacher_id = ?
         ORDER BY ep.date_created DESC"
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
            "subject" => $row["subject_name"],
            "subject_meta" => implode(" - ", $subjectMeta),
            "date_created" => $row["date_created"],
            "assessment_status" => $row["assessment_status"],
            "status" => $row["assessment_status"],
            "item_count" => 0,
            "items" => [],
        ];
    }
    $stmt->close();

    if (count($assessmentsById) > 0) {
        $itemStmt = $conn->prepare(
            "SELECT
                ei.item_id,
                ei.exercise_id,
                ei.item_no,
                ei.question_type,
                ei.question_content,
                ei.model_solution,
                ei.max_score
             FROM exercise_items ei
             INNER JOIN exercises_problem ep ON ei.exercise_id = ep.exercise_id
             INNER JOIN subject s ON ep.subject_id = s.subject_id
             WHERE s.teacher_id = ?
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
                "model_solution" => $itemRow['model_solution'],
                "max_score" => isset($itemRow['max_score']) ? (float)$itemRow['max_score'] : 1.0,
            ];
            $assessmentsById[$exerciseId]['item_count']++;
        }
        $itemStmt->close();
    }

    echo json_encode(["status" => "success", "assessments" => array_values($assessmentsById)]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
