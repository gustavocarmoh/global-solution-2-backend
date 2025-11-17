CREATE OR REPLACE PROCEDURE proc_release_expired_bookings (p_released OUT NUMBER) AS
BEGIN
  UPDATE bookings
     SET status = 'FINISHED'
   WHERE status = 'ACTIVE'
     AND end_time < SYSTIMESTAMP;

  p_released := SQL%ROWCOUNT;
  COMMIT;
END;
/

SHOW ERRORS;
