package vn.vku.nihongoai.auth;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vku.nihongoai.auth.dto.LoginRequest;

import static org.junit.jupiter.api.Assertions.*;

class AuthValidationTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @Test
    void testAdminEmailValidation() {
        LoginRequest req = new LoginRequest();
        req.setEmail("admin@nihongoai.local");
        req.setPassword("admin123");

        var violations = validator.validate(req);
        assertTrue(violations.isEmpty(), "Violations should be empty but was: " + violations);
    }
}
