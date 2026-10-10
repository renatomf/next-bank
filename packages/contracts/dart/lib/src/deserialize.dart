import 'package:nextbank_api/src/model/active_session.dart';
import 'package:nextbank_api/src/model/auth_tokens.dart';
import 'package:nextbank_api/src/model/authorize_pix_transfer_request_input.dart';
import 'package:nextbank_api/src/model/change_password_request_input.dart';
import 'package:nextbank_api/src/model/change_pin_request_input.dart';
import 'package:nextbank_api/src/model/create_pin_request_input.dart';
import 'package:nextbank_api/src/model/create_pix_transfer_request_input.dart';
import 'package:nextbank_api/src/model/create_pix_transfer_request_input_key.dart';
import 'package:nextbank_api/src/model/health.dart';
import 'package:nextbank_api/src/model/login_request_input.dart';
import 'package:nextbank_api/src/model/me.dart';
import 'package:nextbank_api/src/model/money.dart';
import 'package:nextbank_api/src/model/money_input.dart';
import 'package:nextbank_api/src/model/my_account.dart';
import 'package:nextbank_api/src/model/pix_key_lookup.dart';
import 'package:nextbank_api/src/model/pix_key_lookup_request_input.dart';
import 'package:nextbank_api/src/model/pix_payee.dart';
import 'package:nextbank_api/src/model/pix_transfer.dart';
import 'package:nextbank_api/src/model/problem.dart';
import 'package:nextbank_api/src/model/refresh_request_input.dart';
import 'package:nextbank_api/src/model/register_request_input.dart';
import 'package:nextbank_api/src/model/session_list.dart';
import 'package:nextbank_api/src/model/statement.dart';
import 'package:nextbank_api/src/model/statement_counterparty.dart';
import 'package:nextbank_api/src/model/statement_item.dart';
import 'package:nextbank_api/src/model/verify_pin_request_input.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

  ReturnType deserialize<ReturnType, BaseType>(dynamic value, String targetType, {bool growable= true}) {
      switch (targetType) {
        case 'String':
          return '$value' as ReturnType;
        case 'int':
          return (value is int ? value : int.parse('$value')) as ReturnType;
        case 'bool':
          if (value is bool) {
            return value as ReturnType;
          }
          final valueString = '$value'.toLowerCase();
          return (valueString == 'true' || valueString == '1') as ReturnType;
        case 'double':
          return (value is double ? value : double.parse('$value')) as ReturnType;
        case 'ActiveSession':
          return ActiveSession.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'AuthTokens':
          return AuthTokens.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'AuthorizePixTransferRequestInput':
          return AuthorizePixTransferRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ChangePasswordRequestInput':
          return ChangePasswordRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'ChangePinRequestInput':
          return ChangePinRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'CreatePinRequestInput':
          return CreatePinRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'CreatePixTransferRequestInput':
          return CreatePixTransferRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'CreatePixTransferRequestInputKey':
          return CreatePixTransferRequestInputKey.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Health':
          return Health.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'LoginRequestInput':
          return LoginRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Me':
          return Me.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Money':
          return Money.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MoneyInput':
          return MoneyInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'MyAccount':
          return MyAccount.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PixKeyLookup':
          return PixKeyLookup.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PixKeyLookupRequestInput':
          return PixKeyLookupRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PixPayee':
          return PixPayee.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'PixTransfer':
          return PixTransfer.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Problem':
          return Problem.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'RefreshRequestInput':
          return RefreshRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'RegisterRequestInput':
          return RegisterRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'SessionList':
          return SessionList.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'Statement':
          return Statement.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'StatementCounterparty':
          return StatementCounterparty.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'StatementItem':
          return StatementItem.fromJson(value as Map<String, dynamic>) as ReturnType;
        case 'VerifyPinRequestInput':
          return VerifyPinRequestInput.fromJson(value as Map<String, dynamic>) as ReturnType;
        default:
          RegExpMatch? match;

          if (value is List && (match = _regList.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toList(growable: growable) as ReturnType;
          }
          if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
            targetType = match![1]!; // ignore: parameter_assignments
            return value
              .map<BaseType>((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable))
              .toSet() as ReturnType;
          }
          if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
            targetType = match![1]!.trim(); // ignore: parameter_assignments
            return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map((dynamic v) => deserialize<BaseType, BaseType>(v, targetType, growable: growable)),
            ) as ReturnType;
          }
          break;
    }
    throw Exception('Cannot deserialize');
  }