<?php
require_once 'cors.php';
require_once 'db_connection.php';
require_once 'schema_utils.php';

$collegeTable = resolveExistingTableName($conn, ['Colleges', 'colleges', 'college']);
$sql = "
    SELECT MIN(college_id) AS college_id, college_name
    FROM {$collegeTable}
    WHERE college_name IN ('College of Teacher Education', 'College of Sciences')
    GROUP BY college_name
    ORDER BY FIELD(college_name, 'College of Teacher Education', 'College of Sciences')
";
$result = $conn->query($sql);

$colleges = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $colleges[] = $row;
    }
}

echo json_encode($colleges);
?>
