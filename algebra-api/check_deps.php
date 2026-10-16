<?php
echo class_exists('Imagick') ? 'Imagick: YES' : 'Imagick: NO';
echo PHP_EOL;
exec('libreoffice --version 2>&1', $out, $ret);
echo 'LibreOffice: ' . ($ret === 0 ? 'YES' : 'NO');
echo PHP_EOL;